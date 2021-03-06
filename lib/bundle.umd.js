(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('apollo-link'), require('symbol-observable'), require('apollo-utilities'), require('graphql/language/printer'), require('apollo-link-dedup')) :
    typeof define === 'function' && define.amd ? define(['exports', 'apollo-link', 'symbol-observable', 'apollo-utilities', 'graphql/language/printer', 'apollo-link-dedup'], factory) :
    (factory((global.apollo = global.apollo || {}, global.apollo.core = {}),global.apolloLink.core,null,global.apollo.utilities,null,global.apolloLink.dedup));
}(this, (function (exports,apolloLink,$$observable,apolloUtilities,printer,apolloLinkDedup) { 'use strict';

    $$observable = $$observable && $$observable.hasOwnProperty('default') ? $$observable['default'] : $$observable;

    /**
     * The current status of a query’s execution in our system.
     */
    (function (NetworkStatus) {
        /**
         * The query has never been run before and the query is now currently running. A query will still
         * have this network status even if a partial data result was returned from the cache, but a
         * query was dispatched anyway.
         */
        NetworkStatus[NetworkStatus["loading"] = 1] = "loading";
        /**
         * If `setVariables` was called and a query was fired because of that then the network status
         * will be `setVariables` until the result of that query comes back.
         */
        NetworkStatus[NetworkStatus["setVariables"] = 2] = "setVariables";
        /**
         * Indicates that `fetchMore` was called on this query and that the query created is currently in
         * flight.
         */
        NetworkStatus[NetworkStatus["fetchMore"] = 3] = "fetchMore";
        /**
         * Similar to the `setVariables` network status. It means that `refetch` was called on a query
         * and the refetch request is currently in flight.
         */
        NetworkStatus[NetworkStatus["refetch"] = 4] = "refetch";
        /**
         * Indicates that a polling query is currently in flight. So for example if you are polling a
         * query every 10 seconds then the network status will switch to `poll` every 10 seconds whenever
         * a poll request has been sent but not resolved.
         */
        NetworkStatus[NetworkStatus["poll"] = 6] = "poll";
        /**
         * No request is in flight for this query, and no errors happened. Everything is OK.
         */
        NetworkStatus[NetworkStatus["ready"] = 7] = "ready";
        /**
         * No request is in flight for this query, but one or more errors were detected.
         */
        NetworkStatus[NetworkStatus["error"] = 8] = "error";
    })(exports.NetworkStatus || (exports.NetworkStatus = {}));
    /**
     * Returns true if there is currently a network request in flight according to a given network
     * status.
     */
    function isNetworkRequestInFlight(networkStatus) {
        return networkStatus < 7;
    }

    var __extends = (undefined && undefined.__extends) || (function () {
        var extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return function (d, b) {
            extendStatics(d, b);
            function __() { this.constructor = d; }
            d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
        };
    })();
    // rxjs interopt
    var Observable = /** @class */ (function (_super) {
        __extends(Observable, _super);
        function Observable() {
            return _super !== null && _super.apply(this, arguments) || this;
        }
        Observable.prototype[$$observable] = function () {
            return this;
        };
        Observable.prototype['@@observable'] = function () {
            return this;
        };
        return Observable;
    }(apolloLink.Observable));

    var __extends$1 = (undefined && undefined.__extends) || (function () {
        var extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return function (d, b) {
            extendStatics(d, b);
            function __() { this.constructor = d; }
            d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
        };
    })();
    function isApolloError(err) {
        return err.hasOwnProperty('graphQLErrors');
    }
    // Sets the error message on this error according to the
    // the GraphQL and network errors that are present.
    // If the error message has already been set through the
    // constructor or otherwise, this function is a nop.
    var generateErrorMessage = function (err) {
        var message = '';
        // If we have GraphQL errors present, add that to the error message.
        if (Array.isArray(err.graphQLErrors) && err.graphQLErrors.length !== 0) {
            err.graphQLErrors.forEach(function (graphQLError) {
                var errorMessage = graphQLError
                    ? graphQLError.message
                    : 'Error message not found.';
                message += "GraphQL error: " + errorMessage + "\n";
            });
        }
        if (err.networkError) {
            message += 'Network error: ' + err.networkError.message + '\n';
        }
        // strip newline from the end of the message
        message = message.replace(/\n$/, '');
        return message;
    };
    var ApolloError = /** @class */ (function (_super) {
        __extends$1(ApolloError, _super);
        // Constructs an instance of ApolloError given a GraphQLError
        // or a network error. Note that one of these has to be a valid
        // value or the constructed error will be meaningless.
        function ApolloError(_a) {
            var graphQLErrors = _a.graphQLErrors, networkError = _a.networkError, errorMessage = _a.errorMessage, extraInfo = _a.extraInfo;
            var _this = _super.call(this, errorMessage) || this;
            _this.graphQLErrors = graphQLErrors || [];
            _this.networkError = networkError || null;
            if (!errorMessage) {
                _this.message = generateErrorMessage(_this);
            }
            else {
                _this.message = errorMessage;
            }
            _this.extraInfo = extraInfo;
            // We're not using `Object.setPrototypeOf` here as it isn't fully
            // supported on Android (see issue #3236).
            _this.__proto__ = ApolloError.prototype;
            return _this;
        }
        return ApolloError;
    }(Error));

    (function (FetchType) {
        FetchType[FetchType["normal"] = 1] = "normal";
        FetchType[FetchType["refetch"] = 2] = "refetch";
        FetchType[FetchType["poll"] = 3] = "poll";
    })(exports.FetchType || (exports.FetchType = {}));

    var __extends$2 = (undefined && undefined.__extends) || (function () {
        var extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return function (d, b) {
            extendStatics(d, b);
            function __() { this.constructor = d; }
            d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
        };
    })();
    var __assign = (undefined && undefined.__assign) || Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    var hasError = function (storeValue, policy) {
        if (policy === void 0) { policy = 'none'; }
        return storeValue &&
            ((storeValue.graphQLErrors &&
                storeValue.graphQLErrors.length > 0 &&
                policy === 'none') ||
                storeValue.networkError);
    };
    var ObservableQuery = /** @class */ (function (_super) {
        __extends$2(ObservableQuery, _super);
        function ObservableQuery(_a) {
            var scheduler = _a.scheduler, options = _a.options, _b = _a.shouldSubscribe, shouldSubscribe = _b === void 0 ? true : _b;
            var _this = _super.call(this, function (observer) {
                return _this.onSubscribe(observer);
            }) || this;
            // active state
            _this.isCurrentlyPolling = false;
            _this.isTornDown = false;
            // query information
            _this.options = options;
            _this.variables = options.variables || {};
            _this.queryId = scheduler.queryManager.generateQueryId();
            _this.shouldSubscribe = shouldSubscribe;
            // related classes
            _this.scheduler = scheduler;
            _this.queryManager = scheduler.queryManager;
            // interal data stores
            _this.observers = [];
            _this.subscriptionHandles = [];
            return _this;
        }
        ObservableQuery.prototype.result = function () {
            var that = this;
            return new Promise(function (resolve, reject) {
                var subscription;
                var observer = {
                    next: function (result) {
                        resolve(result);
                        // Stop the query within the QueryManager if we can before
                        // this function returns.
                        //
                        // We do this in order to prevent observers piling up within
                        // the QueryManager. Notice that we only fully unsubscribe
                        // from the subscription in a setTimeout(..., 0)  call. This call can
                        // actually be handled by the browser at a much later time. If queries
                        // are fired in the meantime, observers that should have been removed
                        // from the QueryManager will continue to fire, causing an unnecessary
                        // performance hit.
                        if (!that.observers.some(function (obs) { return obs !== observer; })) {
                            that.queryManager.removeQuery(that.queryId);
                        }
                        setTimeout(function () {
                            subscription.unsubscribe();
                        }, 0);
                    },
                    error: function (error) {
                        reject(error);
                    },
                };
                subscription = that.subscribe(observer);
            });
        };
        /**
         * Return the result of the query from the local cache as well as some fetching status
         * `loading` and `networkStatus` allow to know if a request is in flight
         * `partial` lets you know if the result from the local cache is complete or partial
         * @return {result: Object, loading: boolean, networkStatus: number, partial: boolean}
         */
        ObservableQuery.prototype.currentResult = function () {
            if (this.isTornDown) {
                return {
                    data: this.lastError ? {} : this.lastResult ? this.lastResult.data : {},
                    error: this.lastError,
                    loading: false,
                    networkStatus: exports.NetworkStatus.error,
                };
            }
            var queryStoreValue = this.queryManager.queryStore.get(this.queryId);
            if (hasError(queryStoreValue, this.options.errorPolicy)) {
                return {
                    data: {},
                    loading: false,
                    networkStatus: queryStoreValue.networkStatus,
                    error: new ApolloError({
                        graphQLErrors: queryStoreValue.graphQLErrors,
                        networkError: queryStoreValue.networkError,
                    }),
                };
            }
            var _a = this.queryManager.getCurrentQueryResult(this), data = _a.data, partial = _a.partial;
            var queryLoading = !queryStoreValue ||
                queryStoreValue.networkStatus === exports.NetworkStatus.loading;
            // We need to be careful about the loading state we show to the user, to try
            // and be vaguely in line with what the user would have seen from .subscribe()
            // but to still provide useful information synchronously when the query
            // will not end up hitting the server.
            // See more: https://github.com/apollostack/apollo-client/issues/707
            // Basically: is there a query in flight right now (modolo the next tick)?
            var loading = (this.options.fetchPolicy === 'network-only' && queryLoading) ||
                (partial && this.options.fetchPolicy !== 'cache-only');
            // if there is nothing in the query store, it means this query hasn't fired yet or it has been cleaned up. Therefore the
            // network status is dependent on queryLoading.
            var networkStatus;
            if (queryStoreValue) {
                networkStatus = queryStoreValue.networkStatus;
            }
            else {
                networkStatus = loading ? exports.NetworkStatus.loading : exports.NetworkStatus.ready;
            }
            var result = {
                data: data,
                loading: isNetworkRequestInFlight(networkStatus),
                networkStatus: networkStatus,
            };
            if (queryStoreValue &&
                queryStoreValue.graphQLErrors &&
                this.options.errorPolicy === 'all') {
                result.errors = queryStoreValue.graphQLErrors;
            }
            if (!partial) {
                var stale = false;
                this.lastResult = __assign({}, result, { stale: stale });
            }
            return __assign({}, result, { partial: partial });
        };
        // Returns the last result that observer.next was called with. This is not the same as
        // currentResult! If you're not sure which you need, then you probably need currentResult.
        ObservableQuery.prototype.getLastResult = function () {
            return this.lastResult;
        };
        ObservableQuery.prototype.getLastError = function () {
            return this.lastError;
        };
        ObservableQuery.prototype.resetLastResults = function () {
            delete this.lastResult;
            delete this.lastError;
            this.isTornDown = false;
        };
        ObservableQuery.prototype.refetch = function (variables) {
            var fetchPolicy = this.options.fetchPolicy;
            // early return if trying to read from cache during refetch
            if (fetchPolicy === 'cache-only') {
                return Promise.reject(new Error('cache-only fetchPolicy option should not be used together with query refetch.'));
            }
            if (!apolloUtilities.isEqual(this.variables, variables)) {
                // update observable variables
                this.variables = Object.assign({}, this.variables, variables);
            }
            if (!apolloUtilities.isEqual(this.options.variables, this.variables)) {
                // Update the existing options with new variables
                this.options.variables = Object.assign({}, this.options.variables, this.variables);
            }
            // Override fetchPolicy for this call only
            // only network-only and no-cache are safe to use
            var isNetworkFetchPolicy = fetchPolicy === 'network-only' || fetchPolicy === 'no-cache';
            var combinedOptions = __assign({}, this.options, { fetchPolicy: isNetworkFetchPolicy ? fetchPolicy : 'network-only' });
            return this.queryManager
                .fetchQuery(this.queryId, combinedOptions, exports.FetchType.refetch)
                .then(function (result) { return apolloUtilities.maybeDeepFreeze(result); });
        };
        ObservableQuery.prototype.fetchMore = function (fetchMoreOptions) {
            var _this = this;
            // early return if no update Query
            if (!fetchMoreOptions.updateQuery) {
                throw new Error('updateQuery option is required. This function defines how to update the query data with the new results.');
            }
            var combinedOptions;
            return Promise.resolve()
                .then(function () {
                var qid = _this.queryManager.generateQueryId();
                if (fetchMoreOptions.query) {
                    // fetch a new query
                    combinedOptions = fetchMoreOptions;
                }
                else {
                    // fetch the same query with a possibly new variables
                    combinedOptions = __assign({}, _this.options, fetchMoreOptions, { variables: Object.assign({}, _this.variables, fetchMoreOptions.variables) });
                }
                combinedOptions.fetchPolicy = 'network-only';
                return _this.queryManager.fetchQuery(qid, combinedOptions, exports.FetchType.normal, _this.queryId);
            })
                .then(function (fetchMoreResult) {
                _this.updateQuery(function (previousResult) {
                    return fetchMoreOptions.updateQuery(previousResult, {
                        fetchMoreResult: fetchMoreResult.data,
                        variables: combinedOptions.variables,
                    });
                });
                return fetchMoreResult;
            });
        };
        // XXX the subscription variables are separate from the query variables.
        // if you want to update subscription variables, right now you have to do that separately,
        // and you can only do it by stopping the subscription and then subscribing again with new variables.
        ObservableQuery.prototype.subscribeToMore = function (options) {
            var _this = this;
            var subscription = this.queryManager
                .startGraphQLSubscription({
                query: options.document,
                variables: options.variables,
            })
                .subscribe({
                next: function (data) {
                    if (options.updateQuery) {
                        _this.updateQuery(function (previous, _a) {
                            var variables = _a.variables;
                            return options.updateQuery(previous, {
                                subscriptionData: data,
                                variables: variables,
                            });
                        });
                    }
                },
                error: function (err) {
                    if (options.onError) {
                        options.onError(err);
                        return;
                    }
                    console.error('Unhandled GraphQL subscription error', err);
                },
            });
            this.subscriptionHandles.push(subscription);
            return function () {
                var i = _this.subscriptionHandles.indexOf(subscription);
                if (i >= 0) {
                    _this.subscriptionHandles.splice(i, 1);
                    subscription.unsubscribe();
                }
            };
        };
        // Note: if the query is not active (there are no subscribers), the promise
        // will return null immediately.
        ObservableQuery.prototype.setOptions = function (opts) {
            var oldOptions = this.options;
            this.options = Object.assign({}, this.options, opts);
            if (opts.pollInterval) {
                this.startPolling(opts.pollInterval);
            }
            else if (opts.pollInterval === 0) {
                this.stopPolling();
            }
            // If fetchPolicy went from cache-only to something else, or from something else to network-only
            var tryFetch = (oldOptions.fetchPolicy !== 'network-only' &&
                opts.fetchPolicy === 'network-only') ||
                (oldOptions.fetchPolicy === 'cache-only' &&
                    opts.fetchPolicy !== 'cache-only') ||
                (oldOptions.fetchPolicy === 'standby' &&
                    opts.fetchPolicy !== 'standby') ||
                false;
            return this.setVariables(this.options.variables, tryFetch, opts.fetchResults);
        };
        /**
         * Update the variables of this observable query, and fetch the new results
         * if they've changed. If you want to force new results, use `refetch`.
         *
         * Note: if the variables have not changed, the promise will return the old
         * results immediately, and the `next` callback will *not* fire.
         *
         * Note: if the query is not active (there are no subscribers), the promise
         * will return null immediately.
         *
         * @param variables: The new set of variables. If there are missing variables,
         * the previous values of those variables will be used.
         *
         * @param tryFetch: Try and fetch new results even if the variables haven't
         * changed (we may still just hit the store, but if there's nothing in there
         * this will refetch)
         *
         * @param fetchResults: Option to ignore fetching results when updating variables
         *
         */
        ObservableQuery.prototype.setVariables = function (variables, tryFetch, fetchResults) {
            if (tryFetch === void 0) { tryFetch = false; }
            if (fetchResults === void 0) { fetchResults = true; }
            // since setVariables restarts the subscription, we reset the tornDown status
            this.isTornDown = false;
            var newVariables = variables ? variables : this.variables;
            if (apolloUtilities.isEqual(newVariables, this.variables) && !tryFetch) {
                // If we have no observers, then we don't actually want to make a network
                // request. As soon as someone observes the query, the request will kick
                // off. For now, we just store any changes. (See #1077)
                if (this.observers.length === 0 || !fetchResults) {
                    return new Promise(function (resolve) { return resolve(); });
                }
                return this.result();
            }
            else {
                this.variables = newVariables;
                this.options.variables = newVariables;
                // See comment above
                if (this.observers.length === 0) {
                    return new Promise(function (resolve) { return resolve(); });
                }
                // Use the same options as before, but with new variables
                return this.queryManager
                    .fetchQuery(this.queryId, __assign({}, this.options, { variables: this.variables }))
                    .then(function (result) { return apolloUtilities.maybeDeepFreeze(result); });
            }
        };
        ObservableQuery.prototype.updateQuery = function (mapFn) {
            var _a = this.queryManager.getQueryWithPreviousResult(this.queryId), previousResult = _a.previousResult, variables = _a.variables, document = _a.document;
            var newResult = apolloUtilities.tryFunctionOrLogError(function () {
                return mapFn(previousResult, { variables: variables });
            });
            if (newResult) {
                this.queryManager.dataStore.markUpdateQueryResult(document, variables, newResult);
                this.queryManager.broadcastQueries();
            }
        };
        ObservableQuery.prototype.stopPolling = function () {
            if (this.isCurrentlyPolling) {
                this.scheduler.stopPollingQuery(this.queryId);
                this.options.pollInterval = undefined;
                this.isCurrentlyPolling = false;
            }
        };
        ObservableQuery.prototype.startPolling = function (pollInterval) {
            if (this.options.fetchPolicy === 'cache-first' ||
                this.options.fetchPolicy === 'cache-only') {
                throw new Error('Queries that specify the cache-first and cache-only fetchPolicies cannot also be polling queries.');
            }
            if (this.isCurrentlyPolling) {
                this.scheduler.stopPollingQuery(this.queryId);
                this.isCurrentlyPolling = false;
            }
            this.options.pollInterval = pollInterval;
            this.isCurrentlyPolling = true;
            this.scheduler.startPollingQuery(this.options, this.queryId);
        };
        ObservableQuery.prototype.onSubscribe = function (observer) {
            var _this = this;
            // Zen Observable has its own error function, in order to log correctly
            // we need to declare a custom error if nothing is passed
            if (observer._subscription &&
                observer._subscription._observer &&
                !observer._subscription._observer.error) {
                observer._subscription._observer.error = function (error) {
                    console.error('Unhandled error', error.message, error.stack);
                };
            }
            this.observers.push(observer);
            // Deliver initial result
            if (observer.next && this.lastResult)
                observer.next(this.lastResult);
            if (observer.error && this.lastError)
                observer.error(this.lastError);
            // setup the query if it hasn't been done before
            if (this.observers.length === 1)
                this.setUpQuery();
            return function () {
                _this.observers = _this.observers.filter(function (obs) { return obs !== observer; });
                if (_this.observers.length === 0) {
                    _this.tearDownQuery();
                }
            };
        };
        ObservableQuery.prototype.setUpQuery = function () {
            var _this = this;
            if (this.shouldSubscribe) {
                this.queryManager.addObservableQuery(this.queryId, this);
            }
            if (!!this.options.pollInterval) {
                if (this.options.fetchPolicy === 'cache-first' ||
                    this.options.fetchPolicy === 'cache-only') {
                    throw new Error('Queries that specify the cache-first and cache-only fetchPolicies cannot also be polling queries.');
                }
                this.isCurrentlyPolling = true;
                this.scheduler.startPollingQuery(this.options, this.queryId);
            }
            var observer = {
                next: function (result) {
                    _this.lastResult = result;
                    _this.observers.forEach(function (obs) { return obs.next && obs.next(result); });
                },
                error: function (error) {
                    _this.lastError = error;
                    _this.observers.forEach(function (obs) { return obs.error && obs.error(error); });
                },
            };
            this.queryManager.startQuery(this.queryId, this.options, this.queryManager.queryListenerForObserver(this.queryId, this.options, observer));
        };
        ObservableQuery.prototype.tearDownQuery = function () {
            this.isTornDown = true;
            if (this.isCurrentlyPolling) {
                this.scheduler.stopPollingQuery(this.queryId);
                this.isCurrentlyPolling = false;
            }
            // stop all active GraphQL subscriptions
            this.subscriptionHandles.forEach(function (sub) { return sub.unsubscribe(); });
            this.subscriptionHandles = [];
            this.queryManager.removeObservableQuery(this.queryId);
            this.queryManager.stopQuery(this.queryId);
            this.observers = [];
        };
        return ObservableQuery;
    }(Observable));

    // The QueryScheduler is supposed to be a mechanism that schedules polling queries such that
    // they are clustered into the time slots of the QueryBatcher and are batched together. It
    // also makes sure that for a given polling query, if one instance of the query is inflight,
    // another instance will not be fired until the query returns or times out. We do this because
    // another query fires while one is already in flight, the data will stay in the "loading" state
    // even after the first query has returned.
    var __assign$1 = (undefined && undefined.__assign) || Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    var QueryScheduler = /** @class */ (function () {
        function QueryScheduler(_a) {
            var queryManager = _a.queryManager, ssrMode = _a.ssrMode;
            // Map going from queryIds to query options that are in flight.
            this.inFlightQueries = {};
            // Map going from query ids to the query options associated with those queries. Contains all of
            // the queries, both in flight and not in flight.
            this.registeredQueries = {};
            // Map going from polling interval with to the query ids that fire on that interval.
            // These query ids are associated with a set of options in the this.registeredQueries.
            this.intervalQueries = {};
            // Map going from polling interval widths to polling timers.
            this.pollingTimers = {};
            this.ssrMode = false;
            this.queryManager = queryManager;
            this.ssrMode = ssrMode || false;
        }
        QueryScheduler.prototype.checkInFlight = function (queryId) {
            var query = this.queryManager.queryStore.get(queryId);
            return (query &&
                query.networkStatus !== exports.NetworkStatus.ready &&
                query.networkStatus !== exports.NetworkStatus.error);
        };
        QueryScheduler.prototype.fetchQuery = function (queryId, options, fetchType) {
            var _this = this;
            return new Promise(function (resolve, reject) {
                _this.queryManager
                    .fetchQuery(queryId, options, fetchType)
                    .then(function (result) {
                    resolve(result);
                })
                    .catch(function (error) {
                    reject(error);
                });
            });
        };
        QueryScheduler.prototype.startPollingQuery = function (options, queryId, listener) {
            if (!options.pollInterval) {
                throw new Error('Attempted to start a polling query without a polling interval.');
            }
            // Do not poll in SSR mode
            if (this.ssrMode)
                return queryId;
            this.registeredQueries[queryId] = options;
            if (listener) {
                this.queryManager.addQueryListener(queryId, listener);
            }
            this.addQueryOnInterval(queryId, options);
            return queryId;
        };
        QueryScheduler.prototype.stopPollingQuery = function (queryId) {
            // Remove the query options from one of the registered queries.
            // The polling function will then take care of not firing it anymore.
            delete this.registeredQueries[queryId];
        };
        // Fires the all of the queries on a particular interval. Called on a setInterval.
        QueryScheduler.prototype.fetchQueriesOnInterval = function (interval) {
            var _this = this;
            // XXX this "filter" here is nasty, because it does two things at the same time.
            // 1. remove queries that have stopped polling
            // 2. call fetchQueries for queries that are polling and not in flight.
            // TODO: refactor this to make it cleaner
            this.intervalQueries[interval] = this.intervalQueries[interval].filter(function (queryId) {
                // If queryOptions can't be found from registeredQueries or if it has a
                // different interval, it means that this queryId is no longer registered
                // and should be removed from the list of queries firing on this interval.
                //
                // We don't remove queries from intervalQueries immediately in
                // stopPollingQuery so that we can keep the timer consistent when queries
                // are removed and replaced, and to avoid quadratic behavior when stopping
                // many queries.
                if (!(_this.registeredQueries.hasOwnProperty(queryId) &&
                    _this.registeredQueries[queryId].pollInterval === interval)) {
                    return false;
                }
                // Don't fire this instance of the polling query is one of the instances is already in
                // flight.
                if (_this.checkInFlight(queryId)) {
                    return true;
                }
                var queryOptions = _this.registeredQueries[queryId];
                var pollingOptions = __assign$1({}, queryOptions);
                pollingOptions.fetchPolicy = 'network-only';
                // don't let unhandled rejections happen
                _this.fetchQuery(queryId, pollingOptions, exports.FetchType.poll).catch(function () { });
                return true;
            });
            if (this.intervalQueries[interval].length === 0) {
                clearInterval(this.pollingTimers[interval]);
                delete this.intervalQueries[interval];
            }
        };
        // Adds a query on a particular interval to this.intervalQueries and then fires
        // that query with all the other queries executing on that interval. Note that the query id
        // and query options must have been added to this.registeredQueries before this function is called.
        QueryScheduler.prototype.addQueryOnInterval = function (queryId, queryOptions) {
            var _this = this;
            var interval = queryOptions.pollInterval;
            if (!interval) {
                throw new Error("A poll interval is required to start polling query with id '" + queryId + "'.");
            }
            // If there are other queries on this interval, this query will just fire with those
            // and we don't need to create a new timer.
            if (this.intervalQueries.hasOwnProperty(interval.toString()) &&
                this.intervalQueries[interval].length > 0) {
                this.intervalQueries[interval].push(queryId);
            }
            else {
                this.intervalQueries[interval] = [queryId];
                // set up the timer for the function that will handle this interval
                this.pollingTimers[interval] = setInterval(function () {
                    _this.fetchQueriesOnInterval(interval);
                }, interval);
            }
        };
        // Used only for unit testing.
        QueryScheduler.prototype.registerPollingQuery = function (queryOptions) {
            if (!queryOptions.pollInterval) {
                throw new Error('Attempted to register a non-polling query with the scheduler.');
            }
            return new ObservableQuery({
                scheduler: this,
                options: queryOptions,
            });
        };
        return QueryScheduler;
    }());

    var MutationStore = /** @class */ (function () {
        function MutationStore() {
            this.store = {};
        }
        MutationStore.prototype.getStore = function () {
            return this.store;
        };
        MutationStore.prototype.get = function (mutationId) {
            return this.store[mutationId];
        };
        MutationStore.prototype.initMutation = function (mutationId, mutationString, variables) {
            this.store[mutationId] = {
                mutationString: mutationString,
                variables: variables || {},
                loading: true,
                error: null,
            };
        };
        MutationStore.prototype.markMutationError = function (mutationId, error) {
            var mutation = this.store[mutationId];
            if (!mutation) {
                return;
            }
            mutation.loading = false;
            mutation.error = error;
        };
        MutationStore.prototype.markMutationResult = function (mutationId) {
            var mutation = this.store[mutationId];
            if (!mutation) {
                return;
            }
            mutation.loading = false;
            mutation.error = null;
        };
        MutationStore.prototype.reset = function () {
            this.store = {};
        };
        return MutationStore;
    }());

    var __assign$2 = (undefined && undefined.__assign) || Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    var QueryStore = /** @class */ (function () {
        function QueryStore() {
            this.store = {};
        }
        QueryStore.prototype.getStore = function () {
            return this.store;
        };
        QueryStore.prototype.get = function (queryId) {
            return this.store[queryId];
        };
        QueryStore.prototype.initQuery = function (query) {
            var previousQuery = this.store[query.queryId];
            if (previousQuery &&
                previousQuery.document !== query.document &&
                printer.print(previousQuery.document) !== printer.print(query.document)) {
                // XXX we're throwing an error here to catch bugs where a query gets overwritten by a new one.
                // we should implement a separate action for refetching so that QUERY_INIT may never overwrite
                // an existing query (see also: https://github.com/apollostack/apollo-client/issues/732)
                throw new Error('Internal Error: may not update existing query string in store');
            }
            var isSetVariables = false;
            var previousVariables = null;
            if (query.storePreviousVariables &&
                previousQuery &&
                previousQuery.networkStatus !== exports.NetworkStatus.loading
            // if the previous query was still loading, we don't want to remember it at all.
            ) {
                if (!apolloUtilities.isEqual(previousQuery.variables, query.variables)) {
                    isSetVariables = true;
                    previousVariables = previousQuery.variables;
                }
            }
            // TODO break this out into a separate function
            var networkStatus;
            if (isSetVariables) {
                networkStatus = exports.NetworkStatus.setVariables;
            }
            else if (query.isPoll) {
                networkStatus = exports.NetworkStatus.poll;
            }
            else if (query.isRefetch) {
                networkStatus = exports.NetworkStatus.refetch;
                // TODO: can we determine setVariables here if it's a refetch and the variables have changed?
            }
            else {
                networkStatus = exports.NetworkStatus.loading;
            }
            var graphQLErrors = [];
            if (previousQuery && previousQuery.graphQLErrors) {
                graphQLErrors = previousQuery.graphQLErrors;
            }
            // XXX right now if QUERY_INIT is fired twice, like in a refetch situation, we just overwrite
            // the store. We probably want a refetch action instead, because I suspect that if you refetch
            // before the initial fetch is done, you'll get an error.
            this.store[query.queryId] = {
                document: query.document,
                variables: query.variables,
                previousVariables: previousVariables,
                networkError: null,
                graphQLErrors: graphQLErrors,
                networkStatus: networkStatus,
                metadata: query.metadata,
            };
            // If the action had a `moreForQueryId` property then we need to set the
            // network status on that query as well to `fetchMore`.
            //
            // We have a complement to this if statement in the query result and query
            // error action branch, but importantly *not* in the client result branch.
            // This is because the implementation of `fetchMore` *always* sets
            // `fetchPolicy` to `network-only` so we would never have a client result.
            if (typeof query.fetchMoreForQueryId === 'string' &&
                this.store[query.fetchMoreForQueryId]) {
                this.store[query.fetchMoreForQueryId].networkStatus =
                    exports.NetworkStatus.fetchMore;
            }
        };
        QueryStore.prototype.markQueryResult = function (queryId, result, fetchMoreForQueryId) {
            if (!this.store[queryId])
                return;
            this.store[queryId].networkError = null;
            this.store[queryId].graphQLErrors =
                result.errors && result.errors.length ? result.errors : [];
            this.store[queryId].previousVariables = null;
            this.store[queryId].networkStatus = exports.NetworkStatus.ready;
            // If we have a `fetchMoreForQueryId` then we need to update the network
            // status for that query. See the branch for query initialization for more
            // explanation about this process.
            if (typeof fetchMoreForQueryId === 'string' &&
                this.store[fetchMoreForQueryId]) {
                this.store[fetchMoreForQueryId].networkStatus = exports.NetworkStatus.ready;
            }
        };
        QueryStore.prototype.markQueryError = function (queryId, error, fetchMoreForQueryId) {
            if (!this.store[queryId])
                return;
            this.store[queryId].networkError = error;
            this.store[queryId].networkStatus = exports.NetworkStatus.error;
            // If we have a `fetchMoreForQueryId` then we need to update the network
            // status for that query. See the branch for query initialization for more
            // explanation about this process.
            if (typeof fetchMoreForQueryId === 'string') {
                this.markQueryResultClient(fetchMoreForQueryId, true);
            }
        };
        QueryStore.prototype.markQueryResultClient = function (queryId, complete) {
            if (!this.store[queryId])
                return;
            this.store[queryId].networkError = null;
            this.store[queryId].previousVariables = null;
            this.store[queryId].networkStatus = complete
                ? exports.NetworkStatus.ready
                : exports.NetworkStatus.loading;
        };
        QueryStore.prototype.stopQuery = function (queryId) {
            delete this.store[queryId];
        };
        QueryStore.prototype.reset = function (observableQueryIds) {
            var _this = this;
            // keep only the queries with query ids that are associated with observables
            this.store = Object.keys(this.store)
                .filter(function (queryId) {
                return observableQueryIds.indexOf(queryId) > -1;
            })
                .reduce(function (res, key) {
                // XXX set loading to true so listeners don't trigger unless they want results with partial data
                res[key] = __assign$2({}, _this.store[key], { networkStatus: exports.NetworkStatus.loading });
                return res;
            }, {});
        };
        return QueryStore;
    }());

    var __assign$3 = (undefined && undefined.__assign) || Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
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
            this.deduplicator = apolloLink.ApolloLink.from([new apolloLinkDedup.DedupLink(), link]);
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
                (variables = apolloUtilities.assign({}, apolloUtilities.getDefaultValues(apolloUtilities.getMutationDefinition(mutation)), variables));
            var mutationString = printer.print(mutation);
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
                var operation = _this.buildOperationForLink(mutation, variables, __assign$3({}, context, { optimisticResponse: optimisticResponse }));
                apolloLink.execute(_this.link, operation).subscribe({
                    next: function (result) {
                        if (apolloUtilities.graphQLResultHasError(result) && errorPolicy === 'none') {
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
                            apolloUtilities.graphQLResultHasError(storeResult)) {
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
            if (fetchType !== exports.FetchType.refetch &&
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
            if (apolloUtilities.hasDirectives(['live'], query))
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
                isPoll: fetchType === exports.FetchType.poll,
                isRefetch: fetchType === exports.FetchType.refetch,
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
                            if (!apolloUtilities.isProduction()) {
                                /* tslint:disable-next-line */
                                console.info('An unhandled error was thrown because no error handler is registered ' +
                                    'for the query ' +
                                    printer.print(queryStoreValue.document));
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
                                    observer.next(apolloUtilities.maybeDeepFreeze(resultFromStore));
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
            var queryDefinition = apolloUtilities.getQueryDefinition(options.query);
            // assign variable default values if supplied
            if (queryDefinition.variableDefinitions &&
                queryDefinition.variableDefinitions.length) {
                var defaultValues = apolloUtilities.getDefaultValues(queryDefinition);
                options.variables = apolloUtilities.assign({}, defaultValues, options.variables);
            }
            if (typeof options.notifyOnNetworkStatusChange === 'undefined') {
                options.notifyOnNetworkStatusChange = false;
            }
            var transformedOptions = __assign$3({}, options);
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
            var queryDef = apolloUtilities.getQueryDefinition(observableQuery.options.query);
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
            var definition = apolloUtilities.getQueryDefinition(observableQuery.options.query);
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
            var variables = apolloUtilities.assign({}, apolloUtilities.getDefaultValues(apolloUtilities.getOperationDefinition(query)), options.variables);
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
                    sub = apolloLink.execute(_this.link, operation).subscribe(handler);
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
                return apolloUtilities.maybeDeepFreeze({ data: newData.result, partial: false });
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
                    return apolloUtilities.maybeDeepFreeze({ data: data, partial: false });
                }
                catch (e) {
                    return apolloUtilities.maybeDeepFreeze({ data: {}, partial: true });
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
            var operation = this.buildOperationForLink(document, variables, __assign$3({}, context, { 
                // TODO: Should this be included for all entry points via
                // buildOperationForLink?
                forceFetch: !this.queryDeduplication }));
            var resultFromStore;
            var errorsFromStore;
            return new Promise(function (resolve, reject) {
                _this.addFetchQueryPromise(requestId, resolve, reject);
                var subscription = apolloLink.execute(_this.deduplicator, operation).subscribe({
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
                            networkStatus: exports.NetworkStatus.ready,
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
            return this.queries.get(queryId) || __assign$3({}, defaultQueryInfo);
        };
        QueryManager.prototype.setQuery = function (queryId, updater) {
            var prev = this.getQuery(queryId);
            var newInfo = __assign$3({}, prev, updater(prev));
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
                operationName: apolloUtilities.getOperationName(document) || undefined,
                context: __assign$3({}, extraContext, { cache: cache, 
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

    var DataStore = /** @class */ (function () {
        function DataStore(initialCache) {
            this.cache = initialCache;
        }
        DataStore.prototype.getCache = function () {
            return this.cache;
        };
        DataStore.prototype.markQueryResult = function (result, document, variables, fetchMoreForQueryId, ignoreErrors) {
            if (ignoreErrors === void 0) { ignoreErrors = false; }
            var writeWithErrors = !apolloUtilities.graphQLResultHasError(result);
            if (ignoreErrors && apolloUtilities.graphQLResultHasError(result) && result.data) {
                writeWithErrors = true;
            }
            if (!fetchMoreForQueryId && writeWithErrors) {
                this.cache.write({
                    result: result.data,
                    dataId: 'ROOT_QUERY',
                    query: document,
                    variables: variables,
                });
            }
        };
        DataStore.prototype.markSubscriptionResult = function (result, document, variables) {
            // the subscription interface should handle not sending us results we no longer subscribe to.
            // XXX I don't think we ever send in an object with errors, but we might in the future...
            if (!apolloUtilities.graphQLResultHasError(result)) {
                this.cache.write({
                    result: result.data,
                    dataId: 'ROOT_SUBSCRIPTION',
                    query: document,
                    variables: variables,
                });
            }
        };
        DataStore.prototype.markMutationInit = function (mutation) {
            var _this = this;
            if (mutation.optimisticResponse) {
                var optimistic_1;
                if (typeof mutation.optimisticResponse === 'function') {
                    optimistic_1 = mutation.optimisticResponse(mutation.variables);
                }
                else {
                    optimistic_1 = mutation.optimisticResponse;
                }
                var changeFn_1 = function () {
                    _this.markMutationResult({
                        mutationId: mutation.mutationId,
                        result: { data: optimistic_1 },
                        document: mutation.document,
                        variables: mutation.variables,
                        updateQueries: mutation.updateQueries,
                        update: mutation.update,
                    });
                };
                this.cache.recordOptimisticTransaction(function (c) {
                    var orig = _this.cache;
                    _this.cache = c;
                    try {
                        changeFn_1();
                    }
                    finally {
                        _this.cache = orig;
                    }
                }, mutation.mutationId);
            }
        };
        DataStore.prototype.markMutationResult = function (mutation) {
            var _this = this;
            // Incorporate the result from this mutation into the store
            if (!apolloUtilities.graphQLResultHasError(mutation.result)) {
                var cacheWrites_1 = [];
                cacheWrites_1.push({
                    result: mutation.result.data,
                    dataId: 'ROOT_MUTATION',
                    query: mutation.document,
                    variables: mutation.variables,
                });
                if (mutation.updateQueries) {
                    Object.keys(mutation.updateQueries)
                        .filter(function (id) { return mutation.updateQueries[id]; })
                        .forEach(function (queryId) {
                        var _a = mutation.updateQueries[queryId], query = _a.query, updater = _a.updater;
                        // Read the current query result from the store.
                        var _b = _this.cache.diff({
                            query: query.document,
                            variables: query.variables,
                            returnPartialData: true,
                            optimistic: false,
                        }), currentQueryResult = _b.result, complete = _b.complete;
                        if (!complete) {
                            return;
                        }
                        // Run our reducer using the current query result and the mutation result.
                        var nextQueryResult = apolloUtilities.tryFunctionOrLogError(function () {
                            return updater(currentQueryResult, {
                                mutationResult: mutation.result,
                                queryName: apolloUtilities.getOperationName(query.document) || undefined,
                                queryVariables: query.variables,
                            });
                        });
                        // Write the modified result back into the store if we got a new result.
                        if (nextQueryResult) {
                            cacheWrites_1.push({
                                result: nextQueryResult,
                                dataId: 'ROOT_QUERY',
                                query: query.document,
                                variables: query.variables,
                            });
                        }
                    });
                }
                this.cache.performTransaction(function (c) {
                    cacheWrites_1.forEach(function (write) { return c.write(write); });
                });
                // If the mutation has some writes associated with it then we need to
                // apply those writes to the store by running this reducer again with a
                // write action.
                var update_1 = mutation.update;
                if (update_1) {
                    this.cache.performTransaction(function (c) {
                        apolloUtilities.tryFunctionOrLogError(function () { return update_1(c, mutation.result); });
                    });
                }
            }
        };
        DataStore.prototype.markMutationComplete = function (_a) {
            var mutationId = _a.mutationId, optimisticResponse = _a.optimisticResponse;
            if (!optimisticResponse)
                return;
            this.cache.removeOptimistic(mutationId);
        };
        DataStore.prototype.markUpdateQueryResult = function (document, variables, newResult) {
            this.cache.write({
                result: newResult,
                dataId: 'ROOT_QUERY',
                variables: variables,
                query: document,
            });
        };
        DataStore.prototype.reset = function () {
            return this.cache.reset();
        };
        return DataStore;
    }());

    var version = 'local';

    var __assign$4 = (undefined && undefined.__assign) || Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    var hasSuggestedDevtools = false;
    var supportedDirectives = new apolloLink.ApolloLink(function (operation, forward) {
        operation.query = apolloUtilities.removeConnectionDirectiveFromDocument(operation.query);
        return forward(operation);
    });
    /**
     * This is the primary Apollo Client class. It is used to send GraphQL documents (i.e. queries
     * and mutations) to a GraphQL spec-compliant server over a {@link NetworkInterface} instance,
     * receive results from the server and cache the results in a store. It also delivers updates
     * to GraphQL queries through {@link Observable} instances.
     */
    var ApolloClient = /** @class */ (function () {
        /**
         * Constructs an instance of {@link ApolloClient}.
         *
         * @param link The {@link ApolloLink} over which GraphQL documents will be resolved into a response.
         *
         * @param cache The initial cache to use in the data store.
         *
         * @param ssrMode Determines whether this is being run in Server Side Rendering (SSR) mode.
         *
         * @param ssrForceFetchDelay Determines the time interval before we force fetch queries for a
         * server side render.
         *
         * @param queryDeduplication If set to false, a query will still be sent to the server even if a query
         * with identical parameters (query, variables, operationName) is already in flight.
         *
         */
        function ApolloClient(options) {
            var _this = this;
            this.defaultOptions = {};
            this.resetStoreCallbacks = [];
            var link = options.link, cache = options.cache, _a = options.ssrMode, ssrMode = _a === void 0 ? false : _a, _b = options.ssrForceFetchDelay, ssrForceFetchDelay = _b === void 0 ? 0 : _b, connectToDevTools = options.connectToDevTools, _c = options.queryDeduplication, queryDeduplication = _c === void 0 ? true : _c, defaultOptions = options.defaultOptions;
            if (!link || !cache) {
                throw new Error("\n        In order to initialize Apollo Client, you must specify link & cache properties on the config object.\n        This is part of the required upgrade when migrating from Apollo Client 1.0 to Apollo Client 2.0.\n        For more information, please visit:\n          https://www.apollographql.com/docs/react/basics/setup.html\n        to help you get started.\n      ");
            }
            // remove apollo-client supported directives
            this.link = supportedDirectives.concat(link);
            this.cache = cache;
            this.store = new DataStore(cache);
            this.disableNetworkFetches = ssrMode || ssrForceFetchDelay > 0;
            this.queryDeduplication = queryDeduplication;
            this.ssrMode = ssrMode;
            this.defaultOptions = defaultOptions || {};
            if (ssrForceFetchDelay) {
                setTimeout(function () { return (_this.disableNetworkFetches = false); }, ssrForceFetchDelay);
            }
            this.watchQuery = this.watchQuery.bind(this);
            this.query = this.query.bind(this);
            this.mutate = this.mutate.bind(this);
            this.resetStore = this.resetStore.bind(this);
            this.reFetchObservableQueries = this.reFetchObservableQueries.bind(this);
            // Attach the client instance to window to let us be found by chrome devtools, but only in
            // development mode
            var defaultConnectToDevTools = !apolloUtilities.isProduction() &&
                typeof window !== 'undefined' &&
                !window.__APOLLO_CLIENT__;
            if (typeof connectToDevTools === 'undefined'
                ? defaultConnectToDevTools
                : connectToDevTools && typeof window !== 'undefined') {
                window.__APOLLO_CLIENT__ = this;
            }
            /**
             * Suggest installing the devtools for developers who don't have them
             */
            if (!hasSuggestedDevtools && !apolloUtilities.isProduction()) {
                hasSuggestedDevtools = true;
                if (typeof window !== 'undefined' &&
                    window.document &&
                    window.top === window.self) {
                    // First check if devtools is not installed
                    if (typeof window.__APOLLO_DEVTOOLS_GLOBAL_HOOK__ === 'undefined') {
                        // Only for Chrome
                        if (window &&
                            window.navigator &&
                            window.navigator.userAgent &&
                            window.navigator.userAgent.indexOf('Chrome') > -1) {
                            // tslint:disable-next-line
                            console.debug('Download the Apollo DevTools ' +
                                'for a better development experience: ' +
                                'https://chrome.google.com/webstore/detail/apollo-client-developer-t/jdkknkkbebbapilgoeccciglkfbmbnfm');
                        }
                    }
                }
            }
            this.version = version;
        }
        /**
         * This watches the results of the query according to the options specified and
         * returns an {@link ObservableQuery}. We can subscribe to this {@link ObservableQuery} and
         * receive updated results through a GraphQL observer.
         * <p /><p />
         * Note that this method is not an implementation of GraphQL subscriptions. Rather,
         * it uses Apollo's store in order to reactively deliver updates to your query results.
         * <p /><p />
         * For example, suppose you call watchQuery on a GraphQL query that fetches an person's
         * first name and last name and this person has a particular object identifer, provided by
         * dataIdFromObject. Later, a different query fetches that same person's
         * first and last name and his/her first name has now changed. Then, any observers associated
         * with the results of the first query will be updated with a new result object.
         * <p /><p />
         * See [here](https://medium.com/apollo-stack/the-concepts-of-graphql-bc68bd819be3#.3mb0cbcmc) for
         * a description of store reactivity.
         *
         */
        ApolloClient.prototype.watchQuery = function (options) {
            this.initQueryManager();
            if (this.defaultOptions.watchQuery) {
                options = __assign$4({}, this.defaultOptions.watchQuery, options);
            }
            // XXX Overwriting options is probably not the best way to do this long term...
            if (this.disableNetworkFetches &&
                (options.fetchPolicy === 'network-only' ||
                    options.fetchPolicy === 'cache-and-network')) {
                options = __assign$4({}, options, { fetchPolicy: 'cache-first' });
            }
            return this.queryManager.watchQuery(options);
        };
        /**
         * This resolves a single query according to the options specified and returns a
         * {@link Promise} which is either resolved with the resulting data or rejected
         * with an error.
         *
         * @param options An object of type {@link WatchQueryOptions} that allows us to describe
         * how this query should be treated e.g. whether it is a polling query, whether it should hit the
         * server at all or just resolve from the cache, etc.
         */
        ApolloClient.prototype.query = function (options) {
            this.initQueryManager();
            if (this.defaultOptions.query) {
                options = __assign$4({}, this.defaultOptions.query, options);
            }
            if (options.fetchPolicy === 'cache-and-network') {
                throw new Error('cache-and-network fetchPolicy can only be used with watchQuery');
            }
            // XXX Overwriting options is probably not the best way to do this long term...
            if (this.disableNetworkFetches && options.fetchPolicy === 'network-only') {
                options = __assign$4({}, options, { fetchPolicy: 'cache-first' });
            }
            return this.queryManager.query(options);
        };
        /**
         * This resolves a single mutation according to the options specified and returns a
         * {@link Promise} which is either resolved with the resulting data or rejected with an
         * error.
         *
         * It takes options as an object with the following keys and values:
         */
        ApolloClient.prototype.mutate = function (options) {
            this.initQueryManager();
            if (this.defaultOptions.mutate) {
                options = __assign$4({}, this.defaultOptions.mutate, options);
            }
            return this.queryManager.mutate(options);
        };
        /**
         * This subscribes to a graphql subscription according to the options specified and returns an
         * {@link Observable} which either emits received data or an error.
         */
        ApolloClient.prototype.subscribe = function (options) {
            this.initQueryManager();
            return this.queryManager.startGraphQLSubscription(options);
        };
        /**
         * Tries to read some data from the store in the shape of the provided
         * GraphQL query without making a network request. This method will start at
         * the root query. To start at a specific id returned by `dataIdFromObject`
         * use `readFragment`.
         */
        ApolloClient.prototype.readQuery = function (options) {
            return this.initProxy().readQuery(options);
        };
        /**
         * Tries to read some data from the store in the shape of the provided
         * GraphQL fragment without making a network request. This method will read a
         * GraphQL fragment from any arbitrary id that is currently cached, unlike
         * `readQuery` which will only read from the root query.
         *
         * You must pass in a GraphQL document with a single fragment or a document
         * with multiple fragments that represent what you are reading. If you pass
         * in a document with multiple fragments then you must also specify a
         * `fragmentName`.
         */
        ApolloClient.prototype.readFragment = function (options) {
            return this.initProxy().readFragment(options);
        };
        /**
         * Writes some data in the shape of the provided GraphQL query directly to
         * the store. This method will start at the root query. To start at a a
         * specific id returned by `dataIdFromObject` then use `writeFragment`.
         */
        ApolloClient.prototype.writeQuery = function (options) {
            var result = this.initProxy().writeQuery(options);
            this.queryManager.broadcastQueries();
            return result;
        };
        /**
         * Writes some data in the shape of the provided GraphQL fragment directly to
         * the store. This method will write to a GraphQL fragment from any arbitrary
         * id that is currently cached, unlike `writeQuery` which will only write
         * from the root query.
         *
         * You must pass in a GraphQL document with a single fragment or a document
         * with multiple fragments that represent what you are writing. If you pass
         * in a document with multiple fragments then you must also specify a
         * `fragmentName`.
         */
        ApolloClient.prototype.writeFragment = function (options) {
            var result = this.initProxy().writeFragment(options);
            this.queryManager.broadcastQueries();
            return result;
        };
        /**
         * Sugar for writeQuery & writeFragment
         * This method will construct a query from the data object passed in.
         * If no id is supplied, writeData will write the data to the root.
         * If an id is supplied, writeData will write a fragment to the object
         * specified by the id in the store.
         *
         * Since you aren't passing in a query to check the shape of the data,
         * you must pass in an object that conforms to the shape of valid GraphQL data.
         */
        ApolloClient.prototype.writeData = function (options) {
            var result = this.initProxy().writeData(options);
            this.queryManager.broadcastQueries();
            return result;
        };
        ApolloClient.prototype.__actionHookForDevTools = function (cb) {
            this.devToolsHookCb = cb;
        };
        ApolloClient.prototype.__requestRaw = function (payload) {
            return apolloLink.execute(this.link, payload);
        };
        /**
         * This initializes the query manager that tracks queries and the cache
         */
        ApolloClient.prototype.initQueryManager = function () {
            var _this = this;
            if (this.queryManager)
                return;
            this.queryManager = new QueryManager({
                link: this.link,
                store: this.store,
                queryDeduplication: this.queryDeduplication,
                ssrMode: this.ssrMode,
                onBroadcast: function () {
                    if (_this.devToolsHookCb) {
                        _this.devToolsHookCb({
                            action: {},
                            state: {
                                queries: _this.queryManager.queryStore.getStore(),
                                mutations: _this.queryManager.mutationStore.getStore()
                            },
                            dataWithOptimisticResults: _this.cache.extract(true)
                        });
                    }
                }
            });
        };
        /**
         * Resets your entire store by clearing out your cache and then re-executing
         * all of your active queries. This makes it so that you may guarantee that
         * there is no data left in your store from a time before you called this
         * method.
         *
         * `resetStore()` is useful when your user just logged out. You’ve removed the
         * user session, and you now want to make sure that any references to data you
         * might have fetched while the user session was active is gone.
         *
         * It is important to remember that `resetStore()` *will* refetch any active
         * queries. This means that any components that might be mounted will execute
         * their queries again using your network interface. If you do not want to
         * re-execute any queries then you should make sure to stop watching any
         * active queries.
         */
        ApolloClient.prototype.resetStore = function () {
            var _this = this;
            return Promise.resolve()
                .then(function () {
                return _this.queryManager
                    ? _this.queryManager.clearStore()
                    : Promise.resolve(null);
            })
                .then(function () { return Promise.all(_this.resetStoreCallbacks.map(function (fn) { return fn(); })); })
                .then(function () {
                return _this.queryManager && _this.queryManager.reFetchObservableQueries
                    ? _this.queryManager.reFetchObservableQueries()
                    : Promise.resolve(null);
            });
        };
        /**
         * Allows callbacks to be registered that are executed with the store is reset.
         * onResetStore returns an unsubscribe function for removing your registered callbacks.
         */
        ApolloClient.prototype.onResetStore = function (cb) {
            var _this = this;
            this.resetStoreCallbacks.push(cb);
            return function () {
                _this.resetStoreCallbacks = _this.resetStoreCallbacks.filter(function (c) { return c !== cb; });
            };
        };
        /**
         * Refetches all of your active queries.
         *
         * `reFetchObservableQueries()` is useful if you want to bring the client back to proper state in case of a network outage
         *
         * It is important to remember that `reFetchObservableQueries()` *will* refetch any active
         * queries. This means that any components that might be mounted will execute
         * their queries again using your network interface. If you do not want to
         * re-execute any queries then you should make sure to stop watching any
         * active queries.
         * Takes optional parameter `includeStandby` which will include queries in standby-mode when refetching.
         */
        ApolloClient.prototype.reFetchObservableQueries = function (includeStandby) {
            return this.queryManager
                ? this.queryManager.reFetchObservableQueries(includeStandby)
                : Promise.resolve(null);
        };
        /**
         * Exposes the cache's complete state, in a serializable format for later restoration.
         */
        ApolloClient.prototype.extract = function (optimistic) {
            return this.initProxy().extract(optimistic);
        };
        /**
         * Replaces existing state in the cache (if any) with the values expressed by
         * `serializedState`.
         *
         * Called when hydrating a cache (server side rendering, or offline storage),
         * and also (potentially) during hot reloads.
         */
        ApolloClient.prototype.restore = function (serializedState) {
            return this.initProxy().restore(serializedState);
        };
        /**
         * Initializes a data proxy for this client instance if one does not already
         * exist and returns either a previously initialized proxy instance or the
         * newly initialized instance.
         */
        ApolloClient.prototype.initProxy = function () {
            if (!this.proxy) {
                this.initQueryManager();
                this.proxy = this.cache;
            }
            return this.proxy;
        };
        return ApolloClient;
    }());

    exports.printAST = printer.print;
    exports.ApolloClient = ApolloClient;
    exports.default = ApolloClient;
    exports.ObservableQuery = ObservableQuery;
    exports.ApolloError = ApolloError;

    Object.defineProperty(exports, '__esModule', { value: true });

})));
//# sourceMappingURL=bundle.umd.js.map
