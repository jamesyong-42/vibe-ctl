/**
 * Service proxy errors. The service façade throws these from hot methods
 * when the underlying provider is unavailable, the version is wrong, the
 * tier gate fails, or the service reference hasn't resolved.
 */

export class ServiceUnavailable extends Error {
  override readonly name = 'ServiceUnavailable';
  constructor(
    readonly serviceId: string,
    message?: string,
  ) {
    super(message ?? `Service '${serviceId}' is not available`);
  }
}

export class ServiceAccessDenied extends Error {
  override readonly name = 'ServiceAccessDenied';
  constructor(
    readonly serviceId: string,
    readonly reason: string,
  ) {
    super(`Access to service '${serviceId}' denied: ${reason}`);
  }
}

export class IncompatibleServiceVersion extends Error {
  override readonly name = 'IncompatibleServiceVersion';
  constructor(
    readonly serviceId: string,
    readonly required: string,
    readonly provided: string,
  ) {
    super(`Service '${serviceId}' version mismatch: required ${required}, provided ${provided}`);
  }
}

export class ServiceUnresolved extends Error {
  override readonly name = 'ServiceUnresolved';
  constructor(readonly serviceId: string) {
    super(`Service '${serviceId}' has not resolved yet; await the proxy's readiness first`);
  }
}
