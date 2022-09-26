import DataRequest, { buildInternalId } from "@orbitdaoprotocol/oracle-provider-core/dist/DataRequest";

export function createMockRequest(request: Partial<DataRequest> = {}): DataRequest {
    const id = request.id ?? '1';
    const providerId = request.providerId ?? 'near';

    return {
        id,
        outcomes: [],
        allowedValidators: [],
        resolutionWindows: [
            {
                endTime: new Date(),
                round: 0,
                bondSize: '2',
            }
        ],
        sources: [],
        providerId,
        executeResult: undefined,
        staking: [],
        claimedAmount: undefined,
        finalArbitratorTriggered: false,
        finalizedOutcome: undefined,
        dataType: { type: 'string' },
        config: {
            paidFee: '0',
            validityBond: '1000000',
            minResolutionBond: '100000000000000000000',
        },
        requester: 'bob',
        requiredEnvVariables: [],
        tags: [],
        ...request,
        internalId: buildInternalId(id, providerId, ''),
    };
}
