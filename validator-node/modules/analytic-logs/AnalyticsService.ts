import { IProviderRegistry } from "@orbitdaoprotocol/oracle-provider-core/dist/Core";

export async function getAllProviderBalanceInfo(providerRegistry: IProviderRegistry) {
    const balancesFetchPromise = providerRegistry.activeProviders.map(async (providerId) => {
        const balanceInfo = await providerRegistry.getBalanceInfo(providerId);

        return {
            info: balanceInfo,
            providerId,
        }
    });

    return Promise.all(balancesFetchPromise);
}
