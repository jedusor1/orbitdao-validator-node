import { CommandModule } from 'yargs';

import { ACTIVATED_PROVIDERS, AVAILABLE_PROVIDERS, DB_NAME, DB_PATH, DEBUG, ENV_VARS } from '../config';
import { startNode } from '../core/Node';
import Provider from '@orbitdaoprotocol/oracle-provider-core/dist/Provider';
import ProviderRegistry from '../providers/ProviderRegistry';
import Database from '../services/DatabaseService';
import logger, { createModuleLogger } from '../services/LoggerService';

export const start: CommandModule = {
    command: 'start',
    describe: 'Starts the oracle node',
    handler: async () => {
        const providers: Provider[] = [];
        await Database.startDatabase(DB_PATH, DB_NAME);

        logger.transports.forEach((transport) => {
            // @ts-ignore
            if (transport.name === 'console') {
                transport.level = DEBUG ? 'debug' : 'info';
            }
        });

        ACTIVATED_PROVIDERS.forEach((providerId) => {
            const foundProvider = AVAILABLE_PROVIDERS.find(provider => provider.id === providerId);

            if (foundProvider) {
                providers.push(new foundProvider(ENV_VARS, {
                    database: Database,
                    logger: createModuleLogger(foundProvider.id),
                }));
            }
        });

        if (!providers.length) {
            logger.error('No providers configured..');
            process.exit(1);
        }

        const providerRegistry = new ProviderRegistry(providers);
        startNode(providerRegistry);
    }
};
