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
    const observer = () => {counter++};

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
    const lifecycleOwner = LifecycleOwner.start();
    const flow = new Flow<number>(0);
    const flow2 = flow.map(value => value + 1);
    let counter = 0;
    let observedValue = undefined;
    const observer = (value: unknown) => {
        counter++;
        observedValue = value;
    };
    flow2.observe(lifecycleOwner, observer);
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
    const lifecycleOwner = LifecycleOwner.start();
    const flow = new Flow<number>(0);
    const flow2 = flow.distinctUntilChanged();
    let counter = 0;
    let observedValue = undefined;
    const observer = (value: unknown) => {
        counter++;
        observedValue = value;
    };
    flow2.observe(lifecycleOwner, observer);
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