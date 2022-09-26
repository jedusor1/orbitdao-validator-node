import DataRequest, { VM_ENV_KEY } from "@orbitdaoprotocol/oracle-provider-core/dist/DataRequest";
import { execute, InMemoryCache, LoggedOutcome } from "@orbitdaoprotocol/oracle-vm";
import { ExecuteResult, ExecuteResultType } from "@orbitdaoprotocol/oracle-provider-core/dist/ExecuteResult";
import toPath from 'lodash.topath';

import { promises } from 'fs';
import { EXECUTE_AMOUNT, EXECUTE_INTERVAL } from "../config";
import sleep from "../utils/sleep";
import reduceExecuteResult from "./reduceExecuteResult";
import logger from "../services/LoggerService";

export function convertOldSourcePath(sourcePath: string): string {
    // Keep support for more functions
    if (sourcePath.startsWith('$')) {
        return sourcePath;
    }

    const pathCrumbs = toPath(sourcePath);
    let result = '$';

    pathCrumbs.forEach((crumb) => {
        // Is an array path
        if (!isNaN(Number(crumb))) {
            result += `[${crumb}]`;
        } else if (crumb === '$$last') {
            result += '[-1:]';
        } else {
            result += `.${crumb}`;
        }
    });

    return result;
}

let cachedDefaultBinary: Buffer;

async function loadBinary() {
    try {
        if (cachedDefaultBinary) {
            return cachedDefaultBinary;
        }

        cachedDefaultBinary = await promises.readFile('./scripts/wasm/basic-fetch.wasm');
        return cachedDefaultBinary;
    } catch (error) {
        logger.error(`Could not load binary at ./scripts/wasm/basic-fetch.wasm: ${error}`);
        process.exit(1);
    }
}

loadBinary();

const vmCache = new InMemoryCache();

async function executeWasmJobOnce(request: DataRequest): Promise<ExecuteResult> {
    try {
        const binary = await loadBinary();
        const args: string[] = [
            '0x0000000000000000000000000000000000000001', // id of the wasm file
            JSON.stringify(request.sources.map((source) => ({
                source_path: convertOldSourcePath(source.source_path),
                end_point: source.end_point,
            }))),
            request.dataType.type,
        ];

        if (request.dataType.type === 'number') {
            args.push(request.dataType.multiplier);
        }

        const requiredEnvVariables: NodeJS.ProcessEnv = {};

        // Checking if these exists was already done in the isRequestExecutable()
        request.requiredEnvVariables.forEach((envVar) => {
            requiredEnvVariables[envVar] = process.env[`${VM_ENV_KEY}${envVar}`];
        });

        const executeResult = await execute({
            args,
            env: {
                ...requiredEnvVariables,
                REQUEST_ID: request.id,
                REQUESTER: request.requester,
                TAGS: JSON.stringify(request.tags),
                NUMBER_MULTIPLIER: request.dataType.type === "number" ? request.dataType.multiplier : undefined,
                OUTCOMES: JSON.stringify(request.outcomes),
                DATA_TYPE: request.dataType.type,
            },
            gasLimit: (300_000_000_000_000).toString(),
            randomSeed: '0x0001',
            timestamp: 1,
            binary,
        }, vmCache);

        if (executeResult.code !== 0) {
            return {
                type: ExecuteResultType.Error,
                status: executeResult.code,
                error: executeResult.logs.join('\n'),
            }
        }

        const result: LoggedOutcome = JSON.parse(executeResult.logs[executeResult.logs.length - 1]);

        if (result.type === "Invalid") {
            return {
                type: ExecuteResultType.Error,
                error: executeResult.logs.join('\n'),
                status: executeResult.code,
            };
        }

        return {
            type: ExecuteResultType.Success,
            status: executeResult.code,
            data: result.value,
        }
    } catch (error: any) {
        const combinedError = error?.message ?? JSON.stringify(error);
        logger.error(`${request.internalId} - ${combinedError}`);

        return {
            type: ExecuteResultType.Error,
            error: combinedError,
            status: 1,
        };
    }
}

export default async function executeWasmJob(request: DataRequest): Promise<ExecuteResult> {
    try {
        const results: ExecuteResult[] = [];

        for await (const [index] of new Array(EXECUTE_AMOUNT).entries()) {
            results.push(await executeWasmJobOnce(request));

            if (index !== (EXECUTE_AMOUNT - 1)) await sleep(EXECUTE_INTERVAL);
        }

        const lastResult = results[0];

        if (lastResult?.type === ExecuteResultType.Error) {
            logger.debug(`${request.internalId} - vm(${lastResult.status}): ${lastResult.error}`);
        }

        return reduceExecuteResult(results);
    } catch (error: any) {
        return {
            status: 1,
            error: error?.message ?? JSON.stringify(error),
            type: ExecuteResultType.Error,
        }
    }
}
