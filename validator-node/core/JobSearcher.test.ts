// import { createMockRequest, DataRequestProps } from "../models/DataRequestOld";
import * as DataRequestService from '../services/DataRequestService';
import DataRequest, { buildInternalId } from '@orbitdaoprotocol/oracle-provider-core/dist/DataRequest';
import { OutcomeType } from '@orbitdaoprotocol/oracle-provider-core/dist/Outcome';
import { parseNodeOptions } from "../models/NodeOptions";
import { createMockProviderRegistry } from "../test/mocks/ProviderRegistry";
import JobSearcher from "./JobSearcher";
import { createMockRequest } from '../test/mocks/DataRequest';
import { request } from 'express';
// import { OutcomeType } from "../models/DataRequestOutcome";

describe('JobSearcher', () => {
    let storeDataRequestSpy: jest.SpyInstance<Promise<void>>;
    let validDataRequest: DataRequest = {
        internalId: buildInternalId('1', 'near', ''),
        executeResult: undefined,
        id: '1',
        outcomes: [],
        providerId: 'near',
        resolutionWindows: [],
        staking: [],
        finalizedOutcome: undefined,
        sources: [{
            end_point: '',
            source_path: '',
        }],
        config: {
            paidFee: '0',
            validityBond: '1000000',
            minResolutionBond: '100000000000000000000',
        },
        finalArbitratorTriggered: false,
        dataType: { type: 'string' },
        requester: 'bob',
        requiredEnvVariables: [],
        allowedValidators: [],
        tags: [],
    };

    beforeEach(() => {
        storeDataRequestSpy = jest.spyOn(DataRequestService, 'storeDataRequest');
        storeDataRequestSpy.mockResolvedValue();
    });

    afterEach(() => {
        storeDataRequestSpy.mockRestore();
    });

    describe('constructor', () => {
        it('should convert the data request to visited request ids', () => {
            const dataRequests = [
                createMockRequest({ id: '1', providerId: 'mock' }),
                createMockRequest({ id: '2', providerId: 'mock' }),
                createMockRequest({ id: '3', providerId: 'mock' }),
            ];

            const jobSearcher = new JobSearcher(
                createMockProviderRegistry([]),
                dataRequests.map(d => d.internalId),
            );

            expect(jobSearcher.visitedDataRequestIds).toStrictEqual([
                '1_mock_',
                '2_mock_',
                '3_mock_',
            ]);
        });
    });

    describe('search', () => {
        it('should get any requests that are valid', (done) => {
            const providerRegistry = createMockProviderRegistry();
            const requests = [
                createMockRequest({ ...validDataRequest, id: '1' }),
                createMockRequest({ ...validDataRequest, id: '2' }),
            ];

            providerRegistry.listenForRequests = jest.fn((drCallback) => {
                drCallback(requests);
            });

            const jobSearcher = new JobSearcher(
                providerRegistry,
                [],
            );

            const onDataRequests = jest.fn(() => {
                expect(onDataRequests).toHaveBeenCalledTimes(1);
                expect(onDataRequests).toHaveBeenCalledWith(requests);
                expect(storeDataRequestSpy).toHaveBeenCalledTimes(2);
                expect(jobSearcher.visitedDataRequestIds).toStrictEqual([requests[0].internalId, requests[1].internalId]);

                done();
            });

            expect(jobSearcher.visitedDataRequestIds).toStrictEqual([]);

            jobSearcher.startSearch(onDataRequests);
        });

        it('should skip requests that do not match the validator account id', (done) => {
            const providerRegistry = createMockProviderRegistry();
            providerRegistry.getAccountIdByProvider = jest.fn(() => {
                return 'test.near';
            });

            const requests = [
                createMockRequest({ ...validDataRequest, id: '1' }),
                createMockRequest({ ...validDataRequest, id: '2', allowedValidators: ['notme.near'] }),
            ];

            providerRegistry.listenForRequests = jest.fn((drCallback) => {
                drCallback(requests);
            });

            const jobSearcher = new JobSearcher(
                providerRegistry,
                [],
            );

            const onDataRequests = jest.fn(() => {
                expect(onDataRequests).toHaveBeenCalledTimes(1);
                expect(onDataRequests).toHaveBeenCalledWith([requests[0]]);
                expect(storeDataRequestSpy).toHaveBeenCalledTimes(1);
                expect(jobSearcher.visitedDataRequestIds).toStrictEqual([requests[0].internalId]);

                done();
            });

            expect(jobSearcher.visitedDataRequestIds).toStrictEqual([]);

            jobSearcher.startSearch(onDataRequests);
        });

        it('should include requests that do match the validator account id', (done) => {
            const providerRegistry = createMockProviderRegistry();
            providerRegistry.getAccountIdByProvider = jest.fn(() => {
                return 'test.near';
            });

            const requests = [
                createMockRequest({ ...validDataRequest, id: '1' }),
                createMockRequest({ ...validDataRequest, id: '2', allowedValidators: ['notme.near'] }),
                createMockRequest({ ...validDataRequest, id: '3', allowedValidators: ['test.near'] }),
            ];

            providerRegistry.listenForRequests = jest.fn((drCallback) => {
                drCallback(requests);
            });

            const jobSearcher = new JobSearcher(
                providerRegistry,
                [],
            );

            const onDataRequests = jest.fn(() => {
                expect(onDataRequests).toHaveBeenCalledTimes(1);
                expect(onDataRequests).toHaveBeenCalledWith([requests[0], requests[2]]);
                expect(storeDataRequestSpy).toHaveBeenCalledTimes(2);
                expect(jobSearcher.visitedDataRequestIds).toStrictEqual([requests[0].internalId, requests[2].internalId]);

                done();
            });

            expect(jobSearcher.visitedDataRequestIds).toStrictEqual([]);

            jobSearcher.startSearch(onDataRequests);
        });

        it('should not return any requets that are already visited', (done) => {
            const providerRegistry = createMockProviderRegistry();
            const requests = [
                createMockRequest({ ...validDataRequest, id: '1' }),
                createMockRequest({ ...validDataRequest, id: '2' })
            ];

            providerRegistry.listenForRequests = jest.fn((drCallback) => {
                drCallback(requests);
            });

            const jobSearcher = new JobSearcher(
                providerRegistry,
                [requests[0].internalId],
            );

            const onDataRequests = jest.fn(() => {
                expect(onDataRequests).toHaveBeenCalledTimes(1);
                expect(onDataRequests).toHaveBeenCalledWith([requests[1]]);
                expect(storeDataRequestSpy).toHaveBeenCalledTimes(1);
                expect(jobSearcher.visitedDataRequestIds).toStrictEqual([requests[0].internalId, requests[1].internalId]);

                done();
            });

            expect(jobSearcher.visitedDataRequestIds).toStrictEqual([requests[0].internalId]);
            jobSearcher.startSearch(onDataRequests);
        });

        it('should not return any requests that have a finalized outcome', (done) => {
            const providerRegistry = createMockProviderRegistry();
            const requests = [
                createMockRequest({ ...validDataRequest, id: '1', finalizedOutcome: { type: OutcomeType.Invalid } }),
                createMockRequest({ ...validDataRequest, id: '2', finalizedOutcome: { type: OutcomeType.Invalid }  })
            ];

            providerRegistry.listenForRequests = jest.fn((drCallback) => {
                drCallback(requests);
            });

            const jobSearcher = new JobSearcher(
                providerRegistry,
                [],
            );

            const onDataRequests = jest.fn(() => {
                expect(onDataRequests).toHaveBeenCalledTimes(1);
                expect(onDataRequests).toHaveBeenCalledWith([]);
                expect(storeDataRequestSpy).toHaveBeenCalledTimes(0);
                expect(jobSearcher.visitedDataRequestIds).toStrictEqual([]);

                done();
            });

            expect(jobSearcher.visitedDataRequestIds).toStrictEqual([]);

            jobSearcher.startSearch(onDataRequests);
        });

        it('should not return any requets that have no sources attached to them', (done) => {
            const providerRegistry = createMockProviderRegistry();
            const requests = [
                createMockRequest({ ...validDataRequest, id: '1', sources: [] }),
                createMockRequest({ ...validDataRequest, id: '2', sources: [] })
            ];

            providerRegistry.listenForRequests = jest.fn((drCallback) => {
                drCallback(requests);
            });

            const jobSearcher = new JobSearcher(
                providerRegistry,
                [],
            );

            const onDataRequests = jest.fn(() => {
                expect(onDataRequests).toHaveBeenCalledTimes(1);
                expect(onDataRequests).toHaveBeenCalledWith([]);
                expect(storeDataRequestSpy).toHaveBeenCalledTimes(0);
                expect(jobSearcher.visitedDataRequestIds).toStrictEqual([]);

                done();
            });

            expect(jobSearcher.visitedDataRequestIds).toStrictEqual([]);

            jobSearcher.startSearch(onDataRequests);
        });

        it('should not return any requests that triggered the final arbitrator', (done) => {
            const providerRegistry = createMockProviderRegistry();
            const requests = [
                createMockRequest({ ...validDataRequest, id: '1', finalArbitratorTriggered: true }),
                createMockRequest({ ...validDataRequest, id: '2', finalArbitratorTriggered: true  })
            ];

            providerRegistry.listenForRequests = jest.fn((drCallback) => {
                drCallback(requests);
            });

            const jobSearcher = new JobSearcher(
                providerRegistry,
                [],
            );

            const onDataRequests = jest.fn(() => {
                expect(onDataRequests).toHaveBeenCalledTimes(1);
                expect(onDataRequests).toHaveBeenCalledWith([]);
                expect(storeDataRequestSpy).toHaveBeenCalledTimes(0);
                expect(jobSearcher.visitedDataRequestIds).toStrictEqual([]);

                done();
            });

            expect(jobSearcher.visitedDataRequestIds).toStrictEqual([]);

            jobSearcher.startSearch(onDataRequests);
        });

        it('should skip requests that have env variables that are not configured', (done) => {
            const providerRegistry = createMockProviderRegistry();
            const requests = [
                createMockRequest({ ...validDataRequest, id: '1', requiredEnvVariables: ['THIS_SHOULD_NOT_EXIST'] }),
                createMockRequest({ ...validDataRequest, id: '2' }),
            ];

            providerRegistry.listenForRequests = jest.fn((drCallback) => {
                drCallback(requests);
            });

            const jobSearcher = new JobSearcher(
                providerRegistry,
                [],
            );

            const onDataRequests = jest.fn((result) => {
                expect(result.length).toBe(1);
                expect(onDataRequests).toHaveBeenCalledTimes(1);

                done();
            });

            expect(jobSearcher.visitedDataRequestIds).toStrictEqual([]);

            jobSearcher.startSearch(onDataRequests);
        });
    });
});
