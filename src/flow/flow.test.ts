// noinspection DuplicatedCode

import {test, expect} from 'vitest';
import {Flow} from './flow';
import {LifecycleOwner} from "./lifecycleowner.ts";

test('map value', () => {
    const flow = new Flow(1);
    const flow2 = flow.map(value => value + 1);
    expect(flow2.value).toBe(2);

    flow.value = 2;
    expect(flow2.value).toBe(3);

    flow.value = 3;
    expect(flow2.value).toBe(4);
});

test('delay transform with map until read value', () => {
    const flow = new Flow(1);
    let counter = 0;
    const flow2 = flow.map(value => {
        counter++;
        return value + 1;
    });

    expect(counter).toBe(0);
    // @ts-ignore
    expect(flow2.valueInternal).toBeUndefined();

    flow.value = 2;
    expect(counter).toBe(0);
    // @ts-ignore
    expect(flow2.valueInternal).toBeUndefined();

    expect(counter).toBe(0);
    expect(flow2.value).toBe(3);
    // only run once when value is read
    expect(counter).toBe(1);
});

test('observe primary single flow', () => {
    const lifecycleOwner = new LifecycleOwner();
    const flow = new Flow<number>();
    let counter = 0;
    const observer = () => {
        counter++
    };

    flow.observe(lifecycleOwner, observer);

    // @ts-ignore
    expect(lifecycleOwner.observers.length).toBe(0); // Before start, no observer is added

    lifecycleOwner.onStart();
    flow.observe(lifecycleOwner, observer);
    expect(counter).toBe(0); // No run when start observe because the value is undefined
    flow.value = 2;
    expect(counter).toBe(1);
    flow.value = 3;
    expect(counter).toBe(2);

    lifecycleOwner.onStop();
    flow.value = 4;
    expect(counter).toBe(2); // All observers are removed

    lifecycleOwner.onStart();
    flow.value = 5;
    expect(counter).toBe(2); // All observers are removed
    flow.observe(lifecycleOwner, observer);
    expect(counter).toBe(3); // Run when start observe because the value is defined
});

test('observe secondary single flow', () => {
    const flow = new Flow<number>(0);
    const flow2 = flow.map(value => value + 1);
    let counter = 0;
    let observedValue = undefined;
    const observer = (value: unknown) => {
        counter++;
        observedValue = value;
    };
    flow2.observe(LifecycleOwner.start(), observer);
    expect(counter).toBe(1); // Run when start observe because the value is defined
    // @ts-ignore
    expect(flow2.valueInternal).toBeUndefined(); // Although the observer is run, the actual value is not set yet
    expect(observedValue).toBe(1);

    flow.value = 2;
    expect(counter).toBe(2);
    // @ts-ignore
    expect(flow2.valueInternal).toBe(3); // The actual value is set with the new value of the primary flow
    expect(observedValue).toBe(3);
});

test('distinct until changed', () => {
    const flow = new Flow<number>(0);
    const flow2 = flow.distinctUntilChanged();
    let counter = 0;
    let observedValue = undefined;
    const observer = (value: unknown) => {
        counter++;
        observedValue = value;
    };
    flow2.observe(LifecycleOwner.start(), observer);
    expect(counter).toBe(1); // Run when start observe because the value is defined
    expect(observedValue).toBe(0);

    flow.value = 0;
    expect(counter).toBe(2); // Run because before this, the internal value is undefined
    expect(observedValue).toBe(0);

    flow.value = 0;
    expect(counter).toBe(2); // Not run because the value is not changed

    flow.value = 1;
    expect(counter).toBe(3);

    flow.value = 1;
    expect(counter).toBe(3); // Not run because the value is not changed
});

test('throttle', async () => {
    const flow = new Flow<number>(0);
    const flow2 = flow.throttle(20);
    let counter = 0;
    let observedValue = undefined;
    const observer = (value: unknown) => {
        counter++;
        observedValue = value;
    };

    flow2.observe(LifecycleOwner.start(), observer);
    expect(counter).toBe(1); // Run when start observe because the value is defined
    expect(observedValue).toBe(0);

    flow.value = 1;
    expect(counter).toBe(1); // Not run because the throttle is not expired yet
    expect(observedValue).toBe(0);
    flow.value = 2;
    expect(counter).toBe(1); // Not run because the throttle is not expired yet
    expect(observedValue).toBe(0);
    await sleep(21);
    expect(counter).toBe(2); // Run because the throttle is expired
    expect(observedValue).toBe(2);
});

test("combine 2 flows", () => {
    const flow1 = new Flow<number>(1);
    const flow2 = new Flow<number>(100);
    const flow3 = Flow.combine2(flow1, flow2, (value1, value2) => value1 + value2);

    let counter = 0;
    let observedValue = undefined;
    const observer = (value: unknown) => {
        counter++;
        observedValue = value;
    };
    flow3.observe(LifecycleOwner.start(), observer);

    expect(counter).toBe(1); // Run when start observe because the value is defined
    expect(observedValue).toBe(101);

    flow1.value = 2;
    expect(counter).toBe(2);
    expect(observedValue).toBe(102);

    flow2.value = 200;
    expect(counter).toBe(3);
    expect(observedValue).toBe(202);

    flow1.value = 2;
    expect(counter).toBe(4);
    expect(observedValue).toBe(202);
});

test("combine 2 flows with undefined value", () => {
    const flow1 = new Flow<number>();
    const flow2 = new Flow<number>(100);
    const flow3 = Flow.combine2(flow1, flow2, (value1, value2) => value1 + value2);

    let counter = 0;
    let observedValue = undefined;
    const observer = (value: unknown) => {
        counter++;
        observedValue = value;
    };
    flow3.observe(LifecycleOwner.start(), observer);

    expect(counter).toBe(0); // Run when start observe because the value is defined
    expect(observedValue).toBeUndefined();
});

test("combine 3 flows", () => {
       const flow1 = new Flow<number>(1);
        const flow2 = new Flow<number>(100);
        const flow3 = new Flow<number>(1000);
        const flow4 = Flow.combine3(flow1, flow2, flow3, (value1, value2, value3) => value1 + value2 + value3);

        let counter = 0;
        let observedValue = undefined;
        const observer = (value: unknown) => {
            counter++;
            observedValue = value;
        };
        flow4.observe(LifecycleOwner.start(), observer);

        expect(counter).toBe(1); // Run when start observe because the value is defined
        expect(observedValue).toBe(1101);

        flow1.value = 2;
        expect(counter).toBe(2);
        expect(observedValue).toBe(1102);

        flow2.value = 200;
        expect(counter).toBe(3);
        expect(observedValue).toBe(1202);

        flow3.value = 2000;
        expect(counter).toBe(4);
        expect(observedValue).toBe(2202);

        flow1.value = 2;
        expect(counter).toBe(5);
        expect(observedValue).toBe(2202);
});

test("combine 4 flows", () => {
    const flow1 = new Flow<number>(1);
    const flow2 = new Flow<number>(100);
    const flow3 = new Flow<number>(1000);
    const flow4 = new Flow<number>(10000);
    const flow5 = Flow.combine4(flow1, flow2, flow3, flow4, (value1, value2, value3, value4) => value1 + value2 + value3 + value4);

    let counter = 0;
    let observedValue = undefined;
    const observer = (value: unknown) => {
        counter++;
        observedValue = value;
    };
    flow5.observe(LifecycleOwner.start(), observer);

    expect(counter).toBe(1); // Run when start observe because the value is defined
    expect(observedValue).toBe(11101);

    flow1.value = 2;
    expect(counter).toBe(2);
    expect(observedValue).toBe(11102);

    flow2.value = 200;
    expect(counter).toBe(3);
    expect(observedValue).toBe(11202);

    flow3.value = 2000;
    expect(counter).toBe(4);
    expect(observedValue).toBe(12202);

    flow4.value = 20000;
    expect(counter).toBe(5);
    expect(observedValue).toBe(22202);

    flow1.value = 2;
    expect(counter).toBe(6);
    expect(observedValue).toBe(22202);
});

test("combine list of flows", () => {
    const flow1 = new Flow<number>(1);
    const flow2 = new Flow<number>(100);
    const flow3 = new Flow<number>(1000);
    const flow4 = Flow.combineList([flow1, flow2, flow3],
        (array) => (array as Array<number>).reduce((a, b) => a + b, 0));

    let counter = 0;
    let observedValue = undefined;
    const observer = (value: unknown) => {
        counter++;
        observedValue = value;
    };
    flow4.observe(LifecycleOwner.start(), observer);

    expect(counter).toBe(1); // Run when start observe because the value is defined
    expect(observedValue).toBe(1101);

    flow1.value = 2;
    expect(counter).toBe(2);
    expect(observedValue).toBe(1102);

    flow2.value = 200;
    expect(counter).toBe(3);
    expect(observedValue).toBe(1202);

    flow3.value = 2000;
    expect(counter).toBe(4);
    expect(observedValue).toBe(2202);

    flow1.value = 2;
    expect(counter).toBe(5);
    expect(observedValue).toBe(2202);
});

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
