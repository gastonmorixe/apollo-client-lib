import { getOperationName, tryFunctionOrLogError, graphQLResultHasError, } from 'apollo-utilities';
var DataStore = /** @class */ (function () {
    function DataStore(initialCache) {
        this.cache = initialCache;
    }
    DataStore.prototype.getCache = function () {
        return this.cache;
    };
    DataStore.prototype.markQueryResult = function (result, document, variables, fetchMoreForQueryId, ignoreErrors) {
        if (ignoreErrors === void 0) { ignoreErrors = false; }
        var writeWithErrors = !graphQLResultHasError(result);
        if (ignoreErrors && graphQLResultHasError(result) && result.data) {
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
        if (!graphQLResultHasError(result)) {
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
        if (!graphQLResultHasError(mutation.result)) {
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
                    var nextQueryResult = tryFunctionOrLogError(function () {
                        return updater(currentQueryResult, {
                            mutationResult: mutation.result,
                            queryName: getOperationName(query.document) || undefined,
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
                    tryFunctionOrLogError(function () { return update_1(c, mutation.result); });
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
export { DataStore };
//# sourceMappingURL=store.js.map