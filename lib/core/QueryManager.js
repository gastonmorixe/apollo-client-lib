var __assign = (this && this.__assign) || Object.assign || function(t) {
    for (var s, i = 1, n = arguments.length; i < n; i++) {
        s = arguments[i];
        for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
            t[p] = s[p];
    }
    return t;
};
import { execute, ApolloLink } from 'apollo-link';
import { print } from 'graphql/language/printer';
import { DedupLink as Deduplicator } from 'apollo-link-dedup';
import { assign, getDefaultValues, getMutationDefinition, getOperationDefinition, getOperationName, getQueryDefinition, isProduction, maybeDeepFreeze, hasDirectives, } from 'apollo-utilities';
import { QueryScheduler } from '../scheduler/scheduler';
import { isApolloError, ApolloError } from '../errors/ApolloError';
import { Observable } from '../util/Observable';
import { MutationStore } from '../data/mutations';
import { QueryStore } from '../data/queries';
import { ObservableQuery } from './ObservableQuery';
import { NetworkStatus, isNetworkRequestInFlight } from './networkStatus';
import { FetchType } from './types';
import { graphQLResultHasError } from 'apollo-utilities';
var defaultQueryInfo = {
    listeners: [],
    invalidated: false,
    document: null,
    newData: null,
    lastRequestId: null,
    observableQuery: null,
    subscriptions: [],
};
var QueryManager = /** @class */ (function () {
    function QueryManager(_a) {
        var link = _a.link, _b = _a.queryDeduplication, queryDeduplication = _b === void 0 ? false : _b, store = _a.store, _c = _a.onBroadcast, onBroadcast = _c === void 0 ? function () { return undefined; } : _c, _d = _a.ssrMode, ssrMode = _d === void 0 ? false : _d;
        this.mutationStore = new MutationStore();
        this.queryStore = new QueryStore();
        // let's not start at zero to avoid pain with bad checks
        this.idCounter = 1;
        // XXX merge with ObservableQuery but that needs to be expanded to support mutations and
        // subscriptions as well
        this.queries = new Map();
        // A map going from a requestId to a promise that has not yet been resolved. We use this to keep
        // track of queries that are inflight and reject them in case some
        // destabalizing action occurs (e.g. reset of the Apollo store).
        this.fetchQueryPromises = new Map();
        // A map going from the name of a query to an observer issued for it by watchQuery. This is
        // generally used to refetches for refetchQueries and to update mutation results through
        // updateQueries.
        this.queryIdsByName = {};
        this.link = link;
        this.deduplicator = ApolloLink.from([new Deduplicator(), link]);
        this.queryDeduplication = queryDeduplication;
        this.dataStore = store;
        this.onBroadcast = onBroadcast;
        this.scheduler = new QueryScheduler({ queryManager: this, ssrMode: ssrMode });
    }
    QueryManager.prototype.mutate = function (_a) {
        var _this = this;
        var mutation = _a.mutation, variables = _a.variables, optimisticResponse = _a.optimisticResponse, updateQueriesByName = _a.updateQueries, _b = _a.refetchQueries, refetchQueries = _b === void 0 ? [] : _b, updateWithProxyFn = _a.update, _c = _a.errorPolicy, errorPolicy = _c === void 0 ? 'none' : _c, fetchPolicy = _a.fetchPolicy, _d = _a.context, context = _d === void 0 ? {} : _d;
        if (!mutation) {
            throw new Error('mutation option is required. You must specify your GraphQL document in the mutation option.');
        }
        if (fetchPolicy && fetchPolicy !== 'no-cache') {
            throw new Error("fetchPolicy for mutations currently only supports the 'no-cache' policy");
        }
        var mutationId = this.generateQueryId();
        var cache = this.dataStore.getCache();
        (mutation = cache.transformDocument(mutation)),
            (variables = assign({}, getDefaultValues(getMutationDefinition(mutation)), variables));
        var mutationString = print(mutation);
        this.setQuery(mutationId, function () { return ({ document: mutation }); });
        // Create a map of update queries by id to the query instead of by name.
        var generateUpdateQueriesInfo = function () {
            var ret = {};
            if (updateQueriesByName) {
                Object.keys(updateQueriesByName).forEach(function (queryName) {
                    return (_this.queryIdsByName[queryName] || []).forEach(function (queryId) {
                        ret[queryId] = {
                            updater: updateQueriesByName[queryName],
                            query: _this.queryStore.get(queryId),
                        };
                    });
                });
            }
            return ret;
        };
        this.mutationStore.initMutation(mutationId, mutationString, variables);
        this.dataStore.markMutationInit({
            mutationId: mutationId,
            document: mutation,
            variables: variables || {},
            updateQueries: generateUpdateQueriesInfo(),
            update: updateWithProxyFn,
            optimisticResponse: optimisticResponse,
        });
        this.broadcastQueries();
        return new Promise(function (resolve, reject) {
            var storeResult;
            var error;
            var operation = _this.buildOperationForLink(mutation, variables, __assign({}, context, { optimisticResponse: optimisticResponse }));
            execute(_this.link, operation).subscribe({
                next: function (result) {
                    if (graphQLResultHasError(result) && errorPolicy === 'none') {
                        error = new ApolloError({
                            graphQLErrors: result.errors,
                        });
                        return;
                    }
                    _this.mutationStore.markMutationResult(mutationId);
                    if (fetchPolicy !== 'no-cache') {
                        _this.dataStore.markMutationResult({
                            mutationId: mutationId,
                            result: result,
                            document: mutation,
                            variables: variables || {},
                            updateQueries: generateUpdateQueriesInfo(),
                            update: updateWithProxyFn,
                        });
                    }
                    storeResult = result;
                },
                error: function (err) {
                    _this.mutationStore.markMutationError(mutationId, err);
                    _this.dataStore.markMutationComplete({
                        mutationId: mutationId,
                        optimisticResponse: optimisticResponse,
                    });
                    _this.broadcastQueries();
                    _this.setQuery(mutationId, function () { return ({ document: undefined }); });
                    reject(new ApolloError({
                        networkError: err,
                    }));
                },
                complete: function () {
                    if (error) {
                        _this.mutationStore.markMutationError(mutationId, error);
                    }
                    _this.dataStore.markMutationComplete({
                        mutationId: mutationId,
                        optimisticResponse: optimisticResponse,
                    });
                    _this.broadcastQueries();
                    if (error) {
                        reject(error);
                        return;
                    }
                    // allow for conditional refetches
                    // XXX do we want to make this the only API one day?
                    if (typeof refetchQueries === 'function') {
                        refetchQueries = refetchQueries(storeResult);
                    }
                    if (refetchQueries) {
                        refetchQueries.forEach(function (refetchQuery) {
                            if (typeof refetchQuery === 'string') {
                                _this.refetchQueryByName(refetchQuery);
                                return;
                            }
                            _this.query({
                                query: refetchQuery.query,
                                variables: refetchQuery.variables,
                                fetchPolicy: 'network-only',
                            });
                        });
                    }
                    _this.setQuery(mutationId, function () { return ({ document: undefined }); });
                    if (errorPolicy === 'ignore' &&
                        storeResult &&
                        graphQLResultHasError(storeResult)) {
                        delete storeResult.errors;
                    }
                    resolve(storeResult);
                },
            });
        });
    };
    QueryManager.prototype.fetchQuery = function (queryId, options, fetchType, 
    // This allows us to track if this is a query spawned by a `fetchMore`
    // call for another query. We need this data to compute the `fetchMore`
    // network status for the query this is fetching for.
    fetchMoreForQueryId) {
        var _this = this;
        var _a = options.variables, variables = _a === void 0 ? {} : _a, _b = options.metadata, metadata = _b === void 0 ? null : _b, _c = options.fetchPolicy, fetchPolicy = _c === void 0 ? 'cache-first' : _c;
        var cache = this.dataStore.getCache();
        var query = cache.transformDocument(options.query);
        var storeResult;
        var needToFetch = fetchPolicy === 'network-only' || fetchPolicy === 'no-cache';
        // If this is not a force fetch, we want to diff the query against the
        // store before we fetch it from the network interface.
        // TODO we hit the cache even if the policy is network-first. This could be unnecessary if the network is up.
        if (fetchType !== FetchType.refetch &&
            fetchPolicy !== 'network-only' &&
            fetchPolicy !== 'no-cache') {
            var _d = this.dataStore.getCache().diff({
                query: query,
                variables: variables,
                returnPartialData: true,
                optimistic: false,
            }), complete = _d.complete, result = _d.result;
            // If we're in here, only fetch if we have missing fields
            needToFetch = !complete || fetchPolicy === 'cache-and-network';
            storeResult = result;
        }
        var shouldFetch = needToFetch && fetchPolicy !== 'cache-only' && fetchPolicy !== 'standby';
        // we need to check to see if this is an operation that uses the @live directive
        if (hasDirectives(['live'], query))
            shouldFetch = true;
        var requestId = this.generateRequestId();
        // set up a watcher to listen to cache updates
        var cancel = this.updateQueryWatch(queryId, query, options);
        // Initialize query in store with unique requestId
        this.setQuery(queryId, function () { return ({
            document: query,
            lastRequestId: requestId,
            invalidated: true,
            cancel: cancel,
        }); });
        this.invalidate(true, fetchMoreForQueryId);
        this.queryStore.initQuery({
            queryId: queryId,
            document: query,
            storePreviousVariables: shouldFetch,
            variables: variables,
            isPoll: fetchType === FetchType.poll,
            isRefetch: fetchType === FetchType.refetch,
            metadata: metadata,
            fetchMoreForQueryId: fetchMoreForQueryId,
        });
        this.broadcastQueries();
        // If there is no part of the query we need to fetch from the server (or,
        // fetchPolicy is cache-only), we just write the store result as the final result.
        var shouldDispatchClientResult = !shouldFetch || fetchPolicy === 'cache-and-network';
        if (shouldDispatchClientResult) {
            this.queryStore.markQueryResultClient(queryId, !shouldFetch);
            this.invalidate(true, queryId, fetchMoreForQueryId);
            this.broadcastQueries();
        }
        if (shouldFetch) {
            var networkResult = this.fetchRequest({
                requestId: requestId,
                queryId: queryId,
                document: query,
                options: options,
                fetchMoreForQueryId: fetchMoreForQueryId,
            }).catch(function (error) {
                // This is for the benefit of `refetch` promises, which currently don't get their errors
                // through the store like watchQuery observers do
                if (isApolloError(error)) {
                    throw error;
                }
                else {
                    var lastRequestId = _this.getQuery(queryId).lastRequestId;
                    if (requestId >= (lastRequestId || 1)) {
                        _this.queryStore.markQueryError(queryId, error, fetchMoreForQueryId);
                        _this.invalidate(true, queryId, fetchMoreForQueryId);
                        _this.broadcastQueries();
                    }
                    _this.removeFetchQueryPromise(requestId);
                    throw new ApolloError({ networkError: error });
                }
            });
            // we don't return the promise for cache-and-network since it is already
            // returned below from the cache
            if (fetchPolicy !== 'cache-and-network') {
                return networkResult;
            }
            else {
                // however we need to catch the error so it isn't unhandled in case of
                // network error
                networkResult.catch(function () { });
            }
        }
        // If we have no query to send to the server, we should return the result
        // found within the store.
        return Promise.resolve({ data: storeResult });
    };
    // Returns a query listener that will update the given observer based on the
    // results (or lack thereof) for a particular query.
    QueryManager.prototype.queryListenerForObserver = function (queryId, options, observer) {
        var _this = this;
        var previouslyHadError = false;
        return function (queryStoreValue, newData) {
            // we're going to take a look at the data, so the query is no longer invalidated
            _this.invalidate(false, queryId);
            // The query store value can be undefined in the event of a store
            // reset.
            if (!queryStoreValue)
                return;
            var observableQuery = _this.getQuery(queryId).observableQuery;
            var fetchPolicy = observableQuery
                ? observableQuery.options.fetchPolicy
                : options.fetchPolicy;
            // don't watch the store for queries on standby
            if (fetchPolicy === 'standby')
                return;
            var errorPolicy = observableQuery
                ? observableQuery.options.errorPolicy
                : options.errorPolicy;
            var lastResult = observableQuery
                ? observableQuery.getLastResult()
                : null;
            var lastError = observableQuery ? observableQuery.getLastError() : null;
            var shouldNotifyIfLoading = (!newData && queryStoreValue.previousVariables != null) ||
                fetchPolicy === 'cache-only' ||
                fetchPolicy === 'cache-and-network';
            // if this caused by a cache broadcast but the query is still in flight
            // don't notify the observer
            // if (
            //   isCacheBroadcast &&
            //   isNetworkRequestInFlight(queryStoreValue.networkStatus)
            // ) {
            //   shouldNotifyIfLoading = false;
            // }
            var networkStatusChanged = Boolean(lastResult &&
                queryStoreValue.networkStatus !== lastResult.networkStatus);
            var errorStatusChanged = errorPolicy &&
                (lastError && lastError.graphQLErrors) !==
                    queryStoreValue.graphQLErrors &&
                errorPolicy !== 'none';
            if (!isNetworkRequestInFlight(queryStoreValue.networkStatus) ||
                (networkStatusChanged && options.notifyOnNetworkStatusChange) ||
                shouldNotifyIfLoading) {
                // If we have either a GraphQL error or a network error, we create
                // an error and tell the observer about it.
                if (((!errorPolicy || errorPolicy === 'none') &&
                    queryStoreValue.graphQLErrors &&
                    queryStoreValue.graphQLErrors.length > 0) ||
                    queryStoreValue.networkError) {
                    var apolloError_1 = new ApolloError({
                        graphQLErrors: queryStoreValue.graphQLErrors,
                        networkError: queryStoreValue.networkError,
                    });
                    previouslyHadError = true;
                    if (observer.error) {
                        try {
                            observer.error(apolloError_1);
                        }
                        catch (e) {
                            // Throw error outside this control flow to avoid breaking Apollo's state
                            setTimeout(function () {
                                throw e;
                            }, 0);
                        }
                    }
                    else {
                        // Throw error outside this control flow to avoid breaking Apollo's state
                        setTimeout(function () {
                            throw apolloError_1;
                        }, 0);
                        if (!isProduction()) {
                            /* tslint:disable-next-line */
                            console.info('An unhandled error was thrown because no error handler is registered ' +
                                'for the query ' +
                                print(queryStoreValue.document));
                        }
                    }
                    return;
                }
                try {
                    var data = void 0;
                    var isMissing = void 0;
                    if (newData) {
                        // clear out the latest new data, since we're now using it
                        _this.setQuery(queryId, function () { return ({ newData: null }); });
                        data = newData.result;
                        isMissing = !newData.complete ? !newData.complete : false;
                    }
                    else {
                        if (lastResult && lastResult.data && !errorStatusChanged) {
                            data = lastResult.data;
                            isMissing = false;
                        }
                        else {
                            var document_1 = _this.getQuery(queryId).document;
                            var readResult = _this.dataStore.getCache().diff({
                                query: document_1,
                                variables: queryStoreValue.previousVariables ||
                                    queryStoreValue.variables,
                                optimistic: true,
                            });
                            data = readResult.result;
                            isMissing = !readResult.complete;
                        }
                    }
                    var resultFromStore = void 0;
                    // If there is some data missing and the user has told us that they
                    // do not tolerate partial data then we want to return the previous
                    // result and mark it as stale.
                    if (isMissing && fetchPolicy !== 'cache-only') {
                        resultFromStore = {
                            data: lastResult && lastResult.data,
                            loading: isNetworkRequestInFlight(queryStoreValue.networkStatus),
                            networkStatus: queryStoreValue.networkStatus,
                            stale: true,
                        };
                    }
                    else {
                        resultFromStore = {
                            data: data,
                            loading: isNetworkRequestInFlight(queryStoreValue.networkStatus),
                            networkStatus: queryStoreValue.networkStatus,
                            stale: false,
                        };
                    }
                    // if the query wants updates on errors we need to add it to the result
                    if (errorPolicy === 'all' &&
                        queryStoreValue.graphQLErrors &&
                        queryStoreValue.graphQLErrors.length > 0) {
                        resultFromStore.errors = queryStoreValue.graphQLErrors;
                    }
                    if (observer.next) {
                        var isDifferentResult = !(lastResult &&
                            resultFromStore &&
                            lastResult.networkStatus === resultFromStore.networkStatus &&
                            lastResult.stale === resultFromStore.stale &&
                            // We can do a strict equality check here because we include a `previousResult`
                            // with `readQueryFromStore`. So if the results are the same they will be
                            // referentially equal.
                            lastResult.data === resultFromStore.data);
                        if (isDifferentResult || previouslyHadError) {
                            try {
                                observer.next(maybeDeepFreeze(resultFromStore));
                            }
                            catch (e) {
                                // Throw error outside this control flow to avoid breaking Apollo's state
                                setTimeout(function () {
                                    throw e;
                                }, 0);
                            }
                        }
                    }
                    previouslyHadError = false;
                }
                catch (error) {
                    previouslyHadError = true;
                    if (observer.error)
                        observer.error(new ApolloError({ networkError: error }));
                    return;
                }
            }
        };
    };
    // The shouldSubscribe option is a temporary fix that tells us whether watchQuery was called
    // directly (i.e. through ApolloClient) or through the query method within QueryManager.
    // Currently, the query method uses watchQuery in order to handle non-network errors correctly
    // but we don't want to keep track observables issued for the query method since those aren't
    // supposed to be refetched in the event of a store reset. Once we unify error handling for
    // network errors and non-network errors, the shouldSubscribe option will go away.
    QueryManager.prototype.watchQuery = function (options, shouldSubscribe) {
        if (shouldSubscribe === void 0) { shouldSubscribe = true; }
        if (options.fetchPolicy === 'standby') {
            throw new Error('client.watchQuery cannot be called with fetchPolicy set to "standby"');
        }
        // get errors synchronously
        var queryDefinition = getQueryDefinition(options.query);
        // assign variable default values if supplied
        if (queryDefinition.variableDefinitions &&
            queryDefinition.variableDefinitions.length) {
            var defaultValues = getDefaultValues(queryDefinition);
            options.variables = assign({}, defaultValues, options.variables);
        }
        if (typeof options.notifyOnNetworkStatusChange === 'undefined') {
            options.notifyOnNetworkStatusChange = false;
        }
        var transformedOptions = __assign({}, options);
        return new ObservableQuery({
            scheduler: this.scheduler,
            options: transformedOptions,
            shouldSubscribe: shouldSubscribe,
        });
    };
    QueryManager.prototype.query = function (options) {
        var _this = this;
        if (!options.query) {
            throw new Error('query option is required. You must specify your GraphQL document in the query option.');
        }
        if (options.query.kind !== 'Document') {
            throw new Error('You must wrap the query string in a "gql" tag.');
        }
        if (options.returnPartialData) {
            throw new Error('returnPartialData option only supported on watchQuery.');
        }
        if (options.pollInterval) {
            throw new Error('pollInterval option only supported on watchQuery.');
        }
        if (typeof options.notifyOnNetworkStatusChange !== 'undefined') {
            throw new Error('Cannot call "query" with "notifyOnNetworkStatusChange" option. Only "watchQuery" has that option.');
        }
        options.notifyOnNetworkStatusChange = false;
        var requestId = this.idCounter;
        return new Promise(function (resolve, reject) {
            _this.addFetchQueryPromise(requestId, resolve, reject);
            return _this.watchQuery(options, false)
                .result()
                .then(function (result) {
                _this.removeFetchQueryPromise(requestId);
                resolve(result);
            })
                .catch(function (error) {
                _this.removeFetchQueryPromise(requestId);
                reject(error);
            });
        });
    };
    QueryManager.prototype.generateQueryId = function () {
        var queryId = this.idCounter.toString();
        this.idCounter++;
        return queryId;
    };
    QueryManager.prototype.stopQueryInStore = function (queryId) {
        this.queryStore.stopQuery(queryId);
        this.invalidate(true, queryId);
        this.broadcastQueries();
    };
    QueryManager.prototype.addQueryListener = function (queryId, listener) {
        this.setQuery(queryId, function (_a) {
            var _b = _a.listeners, listeners = _b === void 0 ? [] : _b;
            return ({
                listeners: listeners.concat([listener]),
                invalidate: false,
            });
        });
    };
    QueryManager.prototype.updateQueryWatch = function (queryId, document, options) {
        var _this = this;
        var cancel = this.getQuery(queryId).cancel;
        if (cancel)
            cancel();
        var previousResult = function () {
            var previousResult = null;
            var observableQuery = _this.getQuery(queryId).observableQuery;
            if (observableQuery) {
                var lastResult = observableQuery.getLastResult();
                if (lastResult) {
                    previousResult = lastResult.data;
                }
            }
            return previousResult;
        };
        return this.dataStore.getCache().watch({
            query: document,
            variables: options.variables,
            optimistic: true,
            previousResult: previousResult,
            callback: function (newData) {
                _this.setQuery(queryId, function () { return ({ invalidated: true, newData: newData }); });
            },
        });
    };
    // Adds a promise to this.fetchQueryPromises for a given request ID.
    QueryManager.prototype.addFetchQueryPromise = function (requestId, resolve, reject) {
        this.fetchQueryPromises.set(requestId.toString(), {
            resolve: resolve,
            reject: reject,
        });
    };
    // Removes the promise in this.fetchQueryPromises for a particular request ID.
    QueryManager.prototype.removeFetchQueryPromise = function (requestId) {
        this.fetchQueryPromises.delete(requestId.toString());
    };
    // Adds an ObservableQuery to this.observableQueries and to this.observableQueriesByName.
    QueryManager.prototype.addObservableQuery = function (queryId, observableQuery) {
        this.setQuery(queryId, function () { return ({ observableQuery: observableQuery }); });
        // Insert the ObservableQuery into this.observableQueriesByName if the query has a name
        var queryDef = getQueryDefinition(observableQuery.options.query);
        if (queryDef.name && queryDef.name.value) {
            var queryName = queryDef.name.value;
            // XXX we may we want to warn the user about query name conflicts in the future
            this.queryIdsByName[queryName] = this.queryIdsByName[queryName] || [];
            this.queryIdsByName[queryName].push(observableQuery.queryId);
        }
    };
    QueryManager.prototype.removeObservableQuery = function (queryId) {
        var _a = this.getQuery(queryId), observableQuery = _a.observableQuery, cancel = _a.cancel;
        if (cancel)
            cancel();
        if (!observableQuery)
            return;
        var definition = getQueryDefinition(observableQuery.options.query);
        var queryName = definition.name ? definition.name.value : null;
        this.setQuery(queryId, function () { return ({ observableQuery: null }); });
        if (queryName) {
            this.queryIdsByName[queryName] = this.queryIdsByName[queryName].filter(function (val) {
                return !(observableQuery.queryId === val);
            });
        }
    };
    QueryManager.prototype.clearStore = function () {
        // Before we have sent the reset action to the store,
        // we can no longer rely on the results returned by in-flight
        // requests since these may depend on values that previously existed
        // in the data portion of the store. So, we cancel the promises and observers
        // that we have issued so far and not yet resolved (in the case of
        // queries).
        this.fetchQueryPromises.forEach(function (_a) {
            var reject = _a.reject;
            reject(new Error('Store reset while query was in flight(not completed in link chain)'));
        });
        var resetIds = [];
        this.queries.forEach(function (_a, queryId) {
            var observableQuery = _a.observableQuery;
            if (observableQuery)
                resetIds.push(queryId);
        });
        this.queryStore.reset(resetIds);
        this.mutationStore.reset();
        // begin removing data from the store
        var reset = this.dataStore.reset();
        return reset;
    };
    QueryManager.prototype.resetStore = function () {
        var _this = this;
        // Similarly, we have to have to refetch each of the queries currently being
        // observed. We refetch instead of error'ing on these since the assumption is that
        // resetting the store doesn't eliminate the need for the queries currently being
        // watched. If there is an existing query in flight when the store is reset,
        // the promise for it will be rejected and its results will not be written to the
        // store.
        return this.clearStore().then(function () {
            return _this.reFetchObservableQueries();
        });
    };
    QueryManager.prototype.getObservableQueryPromises = function (includeStandby) {
        var _this = this;
        var observableQueryPromises = [];
        this.queries.forEach(function (_a, queryId) {
            var observableQuery = _a.observableQuery;
            if (!observableQuery)
                return;
            var fetchPolicy = observableQuery.options.fetchPolicy;
            observableQuery.resetLastResults();
            if (fetchPolicy !== 'cache-only' &&
                (includeStandby || fetchPolicy !== 'standby')) {
                observableQueryPromises.push(observableQuery.refetch());
            }
            _this.setQuery(queryId, function () { return ({ newData: null }); });
            _this.invalidate(true, queryId);
        });
        return observableQueryPromises;
    };
    QueryManager.prototype.reFetchObservableQueries = function (includeStandby) {
        var observableQueryPromises = this.getObservableQueryPromises(includeStandby);
        this.broadcastQueries();
        return Promise.all(observableQueryPromises);
    };
    QueryManager.prototype.startQuery = function (queryId, options, listener) {
        this.addQueryListener(queryId, listener);
        this.fetchQuery(queryId, options)
            // `fetchQuery` returns a Promise. In case of a failure it should be caucht or else the
            // console will show an `Uncaught (in promise)` message. Ignore the error for now.
            .catch(function () { return undefined; });
        return queryId;
    };
    QueryManager.prototype.startGraphQLSubscription = function (options) {
        var _this = this;
        var query = options.query;
        var cache = this.dataStore.getCache();
        var transformedDoc = cache.transformDocument(query);
        var variables = assign({}, getDefaultValues(getOperationDefinition(query)), options.variables);
        var sub;
        var observers = [];
        return new Observable(function (observer) {
            observers.push(observer);
            // If this is the first observer, actually initiate the network subscription
            if (observers.length === 1) {
                var handler = {
                    next: function (result) {
                        _this.dataStore.markSubscriptionResult(result, transformedDoc, variables);
                        _this.broadcastQueries();
                        // It's slightly awkward that the data for subscriptions doesn't come from the store.
                        observers.forEach(function (obs) {
                            // XXX I'd prefer a different way to handle errors for subscriptions
                            if (obs.next)
                                obs.next(result);
                        });
                    },
                    error: function (error) {
                        observers.forEach(function (obs) {
                            if (obs.error)
                                obs.error(error);
                        });
                    },
                };
                // TODO: Should subscriptions also accept a `context` option to pass
                // through to links?
                var operation = _this.buildOperationForLink(transformedDoc, variables);
                sub = execute(_this.link, operation).subscribe(handler);
            }
            return function () {
                observers = observers.filter(function (obs) { return obs !== observer; });
                // If we removed the last observer, tear down the network subscription
                if (observers.length === 0 && sub) {
                    sub.unsubscribe();
                }
            };
        });
    };
    QueryManager.prototype.stopQuery = function (queryId) {
        this.stopQueryInStore(queryId);
        this.removeQuery(queryId);
    };
    QueryManager.prototype.removeQuery = function (queryId) {
        var subscriptions = this.getQuery(queryId).subscriptions;
        // teardown all links
        subscriptions.forEach(function (x) { return x.unsubscribe(); });
        this.queries.delete(queryId);
    };
    QueryManager.prototype.getCurrentQueryResult = function (observableQuery, optimistic) {
        if (optimistic === void 0) { optimistic = true; }
        var _a = observableQuery.options, variables = _a.variables, query = _a.query;
        var lastResult = observableQuery.getLastResult();
        var newData = this.getQuery(observableQuery.queryId).newData;
        // XXX test this
        if (newData) {
            return maybeDeepFreeze({ data: newData.result, partial: false });
        }
        else {
            try {
                // the query is brand new, so we read from the store to see if anything is there
                var data = this.dataStore.getCache().read({
                    query: query,
                    variables: variables,
                    previousResult: lastResult ? lastResult.data : undefined,
                    optimistic: optimistic,
                });
                return maybeDeepFreeze({ data: data, partial: false });
            }
            catch (e) {
                return maybeDeepFreeze({ data: {}, partial: true });
            }
        }
    };
    QueryManager.prototype.getQueryWithPreviousResult = function (queryIdOrObservable) {
        var observableQuery;
        if (typeof queryIdOrObservable === 'string') {
            var foundObserveableQuery = this.getQuery(queryIdOrObservable).observableQuery;
            if (!foundObserveableQuery) {
                throw new Error("ObservableQuery with this id doesn't exist: " + queryIdOrObservable);
            }
            observableQuery = foundObserveableQuery;
        }
        else {
            observableQuery = queryIdOrObservable;
        }
        var _a = observableQuery.options, variables = _a.variables, query = _a.query;
        var data = this.getCurrentQueryResult(observableQuery, false).data;
        return {
            previousResult: data,
            variables: variables,
            document: query,
        };
    };
    QueryManager.prototype.broadcastQueries = function () {
        var _this = this;
        this.onBroadcast();
        this.queries.forEach(function (info, id) {
            if (!info.invalidated || !info.listeners)
                return;
            info.listeners
                // it's possible for the listener to be undefined if the query is being stopped
                // See here for more detail: https://github.com/apollostack/apollo-client/issues/231
                .filter(function (x) { return !!x; })
                .forEach(function (listener) {
                listener(_this.queryStore.get(id), info.newData);
            });
        });
    };
    // Takes a request id, query id, a query document and information associated with the query
    // and send it to the network interface. Returns
    // a promise for the result associated with that request.
    QueryManager.prototype.fetchRequest = function (_a) {
        var _this = this;
        var requestId = _a.requestId, queryId = _a.queryId, document = _a.document, options = _a.options, fetchMoreForQueryId = _a.fetchMoreForQueryId;
        var variables = options.variables, context = options.context, _b = options.errorPolicy, errorPolicy = _b === void 0 ? 'none' : _b, fetchPolicy = options.fetchPolicy;
        var operation = this.buildOperationForLink(document, variables, __assign({}, context, { 
            // TODO: Should this be included for all entry points via
            // buildOperationForLink?
            forceFetch: !this.queryDeduplication }));
        var resultFromStore;
        var errorsFromStore;
        return new Promise(function (resolve, reject) {
            _this.addFetchQueryPromise(requestId, resolve, reject);
            var subscription = execute(_this.deduplicator, operation).subscribe({
                next: function (result) {
                    // default the lastRequestId to 1
                    var lastRequestId = _this.getQuery(queryId).lastRequestId;
                    if (requestId >= (lastRequestId || 1)) {
                        if (fetchPolicy !== 'no-cache') {
                            try {
                                _this.dataStore.markQueryResult(result, document, variables, fetchMoreForQueryId, errorPolicy === 'ignore' || errorPolicy === 'all');
                            }
                            catch (e) {
                                reject(e);
                                return;
                            }
                        }
                        else {
                            _this.setQuery(queryId, function () { return ({
                                newData: { result: result.data, complete: true },
                            }); });
                        }
                        _this.queryStore.markQueryResult(queryId, result, fetchMoreForQueryId);
                        _this.invalidate(true, queryId, fetchMoreForQueryId);
                        _this.broadcastQueries();
                    }
                    if (result.errors && errorPolicy === 'none') {
                        reject(new ApolloError({
                            graphQLErrors: result.errors,
                        }));
                        return;
                    }
                    else if (errorPolicy === 'all') {
                        errorsFromStore = result.errors;
                    }
                    if (fetchMoreForQueryId || fetchPolicy === 'no-cache') {
                        // We don't write fetchMore results to the store because this would overwrite
                        // the original result in case an @connection directive is used.
                        resultFromStore = result.data;
                    }
                    else {
                        try {
                            // ensure result is combined with data already in store
                            resultFromStore = _this.dataStore.getCache().read({
                                variables: variables,
                                query: document,
                                optimistic: false,
                            });
                            // this will throw an error if there are missing fields in
                            // the results which can happen with errors from the server.
                            // tslint:disable-next-line
                        }
                        catch (e) { }
                    }
                },
                error: function (error) {
                    _this.removeFetchQueryPromise(requestId);
                    _this.setQuery(queryId, function (_a) {
                        var subscriptions = _a.subscriptions;
                        return ({
                            subscriptions: subscriptions.filter(function (x) { return x !== subscription; }),
                        });
                    });
                    reject(error);
                },
                complete: function () {
                    _this.removeFetchQueryPromise(requestId);
                    _this.setQuery(queryId, function (_a) {
                        var subscriptions = _a.subscriptions;
                        return ({
                            subscriptions: subscriptions.filter(function (x) { return x !== subscription; }),
                        });
                    });
                    resolve({
                        data: resultFromStore,
                        errors: errorsFromStore,
                        loading: false,
                        networkStatus: NetworkStatus.ready,
                        stale: false,
                    });
                },
            });
            _this.setQuery(queryId, function (_a) {
                var subscriptions = _a.subscriptions;
                return ({
                    subscriptions: subscriptions.concat([subscription]),
                });
            });
        });
    };
    // Refetches a query given that query's name. Refetches
    // all ObservableQuery instances associated with the query name.
    QueryManager.prototype.refetchQueryByName = function (queryName) {
        var _this = this;
        var refetchedQueries = this.queryIdsByName[queryName];
        // early return if the query named does not exist (not yet fetched)
        // this used to warn but it may be inteneded behavoir to try and refetch
        // un called queries because they could be on different routes
        if (refetchedQueries === undefined)
            return;
        return Promise.all(refetchedQueries
            .map(function (id) { return _this.getQuery(id).observableQuery; })
            .filter(function (x) { return !!x; })
            .map(function (x) { return x.refetch(); }));
    };
    QueryManager.prototype.generateRequestId = function () {
        var requestId = this.idCounter;
        this.idCounter++;
        return requestId;
    };
    QueryManager.prototype.getQuery = function (queryId) {
        return this.queries.get(queryId) || __assign({}, defaultQueryInfo);
    };
    QueryManager.prototype.setQuery = function (queryId, updater) {
        var prev = this.getQuery(queryId);
        var newInfo = __assign({}, prev, updater(prev));
        this.queries.set(queryId, newInfo);
    };
    QueryManager.prototype.invalidate = function (invalidated, queryId, fetchMoreForQueryId) {
        if (queryId)
            this.setQuery(queryId, function () { return ({ invalidated: invalidated }); });
        if (fetchMoreForQueryId) {
            this.setQuery(fetchMoreForQueryId, function () { return ({ invalidated: invalidated }); });
        }
    };
    QueryManager.prototype.buildOperationForLink = function (document, variables, extraContext) {
        var cache = this.dataStore.getCache();
        return {
            query: cache.transformForLink
                ? cache.transformForLink(document)
                : document,
            variables: variables,
            operationName: getOperationName(document) || undefined,
            context: __assign({}, extraContext, { cache: cache, 
                // getting an entry's cache key is useful for cacheResolvers & state-link
                getCacheKey: function (obj) {
                    if (cache.config) {
                        // on the link, we just want the id string, not the full id value from toIdValue
                        return cache.config.dataIdFromObject(obj);
                    }
                    else {
                        throw new Error('To use context.getCacheKey, you need to use a cache that has a configurable dataIdFromObject, like apollo-cache-inmemory.');
                    }
                } }),
        };
    };
    return QueryManager;
}());
export { QueryManager };
//# sourceMappingURL=QueryManager.js.map