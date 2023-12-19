import {Flow, LifecycleOwner} from "./flow";

export function demo() {
    let lifecycleOwner = LifecycleOwner.start();
    const noStartLifecycleOwner = new LifecycleOwner();
    let flow = new Flow<number>();
    let randomFlow = new Flow<number>();

    let flow2 = flow.map(value => {
        // console.log("[flow 2]", value);
        return "Hello " + value;
    });

    let flow3 = flow.map(value => {
        // console.log("[flow 3]", value);
        return Math.trunc(value / 2);
    }).distinctUntilChanged();

    let flow4 = flow.throttle(2500);

    let combine2Flow = flow.combine(randomFlow, (value0, value1) => {
        // console.log("[flow 5]", value0, value1);
        return value0 + value1;
    });

    let combine3Flow = Flow.combineList([flow, randomFlow, flow3], (array) => {
        return array.toString();
    })

    setTimeout(() => {
        console.log("[flow 2] observe");
        flow2.observe(lifecycleOwner, value => console.log("[flow 2]", value));
        flow3.observe(noStartLifecycleOwner, value => console.log("[flow 3]", value));
        flow4.observe(noStartLifecycleOwner, value => console.log("[flow 4]", value));
        randomFlow.observe(lifecycleOwner, value => console.log("[random flow]", value));
        combine2Flow.observe(lifecycleOwner, value => console.log("====>", value));

        combine3Flow.observe(lifecycleOwner, value => console.log("------->", value));
    }, 1000);

    setTimeout(() => {
        flow2.value = "100";
    }, 5000);

    setTimeout(() => {
        console.log("[lifecycle owner] onStop");
        lifecycleOwner.onStop();
    }, 10000);

    setTimeout(() => {
        console.log("stopReceivingUpdates");
        flow3.stopReceivingUpdates();
    }, 7000);

    let count = 0;
    setInterval(() => {
        flow.value = count++;
    }, 500);

    setInterval(() => {
        randomFlow.value = Math.trunc(Math.random() * 100) * 10000;
    }, 1000);
}