import Provider from "@orbitdaoprotocol/oracle-provider-core/dist/Provider";
import DataRequest from "@orbitdaoprotocol/oracle-provider-core/dist/DataRequest";
import Balance from "@orbitdaoprotocol/oracle-provider-core/dist/Balance";
import { Outcome } from "@orbitdaoprotocol/oracle-provider-core/dist/Outcome";
import { ClaimError, ClaimResult, ClaimResultType } from "@orbitdaoprotocol/oracle-provider-core/dist/ClaimResult";
import { StakeResult } from "@orbitdaoprotocol/oracle-provider-core/dist/StakeResult";
import { IProviderRegistry } from "@orbitdaoprotocol/oracle-provider-core/dist/Core";
import logger from "../services/LoggerService";

export default class ProviderRegistry implements IProviderRegistry {
    providers: Provider[];

    constructor(providers: Provider[] = []) {
        this.providers = providers;
    }

    get activeProviders() {
        return this.providers.map(p => p.id);
    }

    getProviderById(id: string): Provider | undefined {
        return this.providers.find(p => p.id === id);
    }

    getAccountIdByProvider(providerId: string): string {
        const provider = this.getProviderById(providerId);
        if (!provider) throw Error(`provider ${providerId} not found`);

        return provider.getAccountId();
    }

    async init() {
        await Promise.all(this.providers.map(p => p.init()));
    }

    async getBalanceInfo(providerId: string): Promise<Balance> {
        const provider = this.getProviderById(providerId);
        if (!provider) throw Error(`provider ${providerId} not found`);

        return provider.getBalanceInfo();
    }

    listenForRequests(onRequests: (requests: DataRequest[], providerId: string) => void) {
        this.providers.forEach((provider) => {
            provider.listenForRequests((requests) => {
                onRequests(requests, provider.id);
            });
        });
    }

    async getDataRequestById(providerId: string, requestId: string): Promise<DataRequest | undefined> {
        const provider = this.getProviderById(providerId);
        if (!provider) return undefined;

        return provider.getDataRequestById(requestId);
    }

    async stake(providerId: string, request: DataRequest, answer: Outcome): Promise<StakeResult> {
        const provider = this.getProviderById(providerId);
        if (!provider) throw new Error(`provider ${providerId} not found`);

        return provider.stake(request, answer);
    }

    async finalize(providerId: string, request: DataRequest): Promise<boolean> {
        try {
            const provider = this.getProviderById(providerId);

            if (!provider) {
                return false;
            }

            const isFinalized = await provider.finalize(request);
            return isFinalized;
        } catch (error) {
            logger.error(`${request.internalId} - ${error}`);
            return false;
        }
    }

    async claim(providerId: string, request: DataRequest): Promise<ClaimResult> {
        const provider = this.getProviderById(providerId);

        if (!provider) {
            return {
                type: ClaimResultType.Error,
                error: ClaimError.Unknown,
            };
        }

        return provider.claim(request);
    }
}
