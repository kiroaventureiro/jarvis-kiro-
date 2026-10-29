/** Provider-neutral preflight for a future isolated Codex SDK worker.
 * This module does not import the SDK, authenticate or start tasks.
 */
export type CodexSdkPreflight = {
 ready:false;
 adapter:"sdk";
 blockers:string[];
};
export function codexSdkPreflight(input:{
 authenticationVerified:boolean;
 isolatedCheckoutVerified:boolean;
 durableQueueVerified:boolean;
 resultChannelVerified:boolean;
 vaultVerified:boolean;
 paidExecutionApproved:boolean;
}):CodexSdkPreflight {
 const blockers=[
  ...(!input.authenticationVerified?["worker_authentication_unverified"]:[]),
  ...(!input.isolatedCheckoutVerified?["isolated_checkout_unverified"]:[]),
  ...(!input.durableQueueVerified?["durable_queue_unverified"]:[]),
  ...(!input.resultChannelVerified?["result_channel_unverified"]:[]),
  ...(!input.vaultVerified?["vault_unverified"]:[]),
  ...(!input.paidExecutionApproved?["execution_cost_not_authorized"]:[]),
 ];
 // Deliberately no readiness promotion: verified integration and runtime code
 // must be reviewed separately before any worker can execute.
 return {ready:false,adapter:"sdk",blockers:blockers.length?blockers:["sdk_adapter_not_implemented"]};
}
