import repl from "repl";
import k8s from "@kubernetes/client-node";

const kc = new k8s.KubeConfig();
kc.loadFromDefault();
const k8sApi = kc.makeApiClient(k8s.CoreV1Api);

const pods = k8sApi.listNamespacedPod(process.env?.APP_NAMESPACE ? process.env.APP_NAMESPACE : "default").then(podList => podList.body.items.map(pod => pod.metadata.name));
console.log(`const pods = k8sApi.listNamespacedPod(${process.env?.APP_NAMESPACE ? process.env.APP_NAMESPACE : "default"});`);

const k8sRepl = repl.start("k8s> ");
k8sRepl.context.k8sApi = k8sApi;
pods.then(x => { k8sRepl.context.pods = x; });
