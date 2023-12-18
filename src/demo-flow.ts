import {Flow, LifecycleOwner} from "./flow";

export function demo() {
    let lifecycleOwner = LifecycleOwner.start();
    let flow = new Flow<number>();
    let randomFlow = new Flow<number>();

    let flow2 = flow.map(value => {
        console.log("[flow 2]", value);
        return "Hello " + value;
    });

    let flow3 = flow.map(value => {
        console.log("[flow 3]", value);
        return Math.trunc(value / 2);
    }).distinctUntilChanged();

    let flow4 = flow.throttle(2500);

    let flow5 = flow.combine(randomFlow, (value0, value1) => {
        console.log("[flow 5]", value0, value1);
        return value0 + value1;
    });

    setTimeout(() => {
        console.log("[flow 2] observe");
        flow2.observe(lifecycleOwner, value => console.log("[flow 2]", value));
        flow3.observe(lifecycleOwner, value => console.log("[flow 3]", value));
        flow4.observe(lifecycleOwner, value => console.log("[flow 4]", value));
        flow5.observe(lifecycleOwner, value => console.log("[flow 5]", value));
    }, 2000);

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