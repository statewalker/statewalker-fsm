/**
 * Returns a "{@link deferred}" object allowing to resolve/reject underlying promise
 * and register completion callbacks.
 * @param {Object} deferred deferred object to which new fields should
 * be attached; if it is not defined then an empty object is used; this method
 * returns this object
 * @return {Object} a deferred object with the following fields and methods:
 * * {@link #promise} field - a  {@link Promise} instance - returning after the deferred
 *   object is resolved
 * * {@link #handled} a boolean field showing if this deferred object was resolved or not
 * * {@link #result} the result of resoving for this deferred object; this field is defined
 *   only if the {@link #handled} flag is `true`
 * * {@link #error} the error of resoving of this deferred object; this field is defined
 *   only if the {@link #handled} flag is `true`
 * * {@link #resolve(result)} method allows to resolve this deferred object with the
 *   specified result; it is a "shortcut" for the {@link #end(null,result)} call
 * * {@link #reject(error)} method rejects the internal promise; it is a "shortcut"
 *   for the `deferred.end(error)` call
 * * {@link #end(error,result)} finalizes the internal promise with the given error or 
 *   finalization result
 * * {@link #done()} method allows to register finalisation callbacks; finalization
 *   callbacks are notified when this deferred object is resolved or rejected 
 *   but the {@link #promise} is not resolved yet;
 */
export function newDeferred(deferred = {})  {

  let resolve, reject, list = [];
  let resolveLatch, latch = new Promise(r => resolveLatch = r);

  /**
   * Promise associated with this deferred object.
   */
  deferred.promise = new Promise((y, n) => (resolve = y, reject = n));

  /** Unique identifier of this deferred object. Used for debugging. */
  deferred.id = `id-${newDeferred._counter = (newDeferred._counter || 0) + 1}`;

  /**
   * This flag shows if this promise was already resolved or not.
   *
   * @type {Boolean}
   */
  deferred.handled = false;
  /**
   * Error returned by this deferred object. By default it is undefined.
   * @type {any}
   */
  deferred.error = undefined;
  /**
   * Result returned by this deferred object. By default it is undefined.
   * @type {any}
   */
  deferred.result = undefined;
  /**
   * This method resolves this promise with the specified value.
   * @param result the resulting value for this promise
   */
  deferred.resolve = (result) => { deferred.end(undefined, result); }
  /**
   * This method resolves this promise with the specified error.
   * @param err the error which used to resolve this promise
   */
  deferred.reject = (err) => { deferred.end(err); }
  /**
   * This method notifies all registred listeners with promise results.
   * @private
   */
  const notify = async (h) => {
    await latch;
    try { await h(deferred.error, deferred.result); }
    catch (err) { try { deferred.onError && await deferred.onError(err); } catch (e) {} }
  };
  /**
   * Registers a new listener to invoke *before* this promise returns the control
   * to the callee.
   * @param {Function} h the listener to register; it will be called
   * before the promise returns the control
   */
  deferred.done = (h) => deferred.handled ? notify(h) : list.push(h);
  /**
   * Finalizes the promise with the specified error or the resulting value.
   * @param e the error used to resolve the promise; if it is not defined
   * (or null) then this promise will be resolved with the resulting value.
   * @param r the resulting value used to resolve the promise; it is
   * taken into account only if the error is not defined.
   */
  deferred.end = async (e, r) => {
    deferred.handled = true;
    deferred.end = () => {};
    try {
      deferred.error = await e;
      deferred.result = await r;
    } catch (error) {
      deferred.error = error;
    }
    resolveLatch();
    const array = list; list = null;
    await Promise.all(array.map(notify));
    if (deferred.error) reject(deferred.error);
    else resolve(deferred.result);
  }
  return deferred;
}
