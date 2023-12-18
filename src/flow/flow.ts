import {LifecycleObserver, LifecycleOwner} from "./lifecycleowner";

interface Observer<T> {
    onChange(value: T): void;
}

class SimpleObserver<T> implements Observer<T> {
    constructor(private callback: (value: T) => void) {
    }

    onChange(value: T): void {
        if (value !== undefined) {
            this.callback(value);
        }
    }
}

class ThrottleObserver<T> implements Observer<T> {
    private timeoutId: number | undefined;

    private currentValue: T | undefined;

    constructor(private observer: Observer<T>, private timeout: number) {
        if (timeout < 0) {
            throw new Error("Timeout must be >= 0");
        }
    }

    onChange(value: T) {
        this.currentValue = value;
        if (this.timeoutId !== undefined) {
            return;
        }
        if (this.timeout == 0) {
            // @ts-ignore
            this.timeoutId = requestAnimationFrame(this.timeoutTick.bind(this));
        } else {
            // @ts-ignore
            this.timeoutId = setTimeout(this.timeoutTick.bind(this), this.timeout);
        }
    }

    private timeoutTick() {
        let newValue = this.currentValue;
        if (newValue === undefined) {
            return;
        }
        this.observer.onChange(newValue);
        this.timeoutId = undefined;
    }
}

export class Flow<T> {
    private valueInternal: T | undefined = undefined;
    private observers: Observer<T>[] = [];
    private internalObservers: Map<Flow<unknown>, Observer<T>> = new Map();

    private isImmutable = false;
    private parent?: Array<Flow<unknown>>;
    private transform?: (a: Array<unknown>) => T;

    /**
     * A flag that indicates whether the value of this flow should be updated when the parent flow's value changes
     * regardless of whether this flow has subscribers.
     * Turning this flag on will cause the value of this flow to be updated even if there are no subscribers.
     * Only use this flag when reading the current value of the flow is required rather than observing the flow.
     */
    private isValueUpdatedReactivelyRequired = false;

    private static immutable<T0, T>(parent: Array<Flow<unknown>>, transform: (value: T0) => T): Flow<T> {
        let flow = new Flow<T>();
        flow.parent = parent;
        // @ts-ignore : Allow unsafe call to transform.
        flow.transform = transform;
        flow.isImmutable = true;
        return flow;
    }

    // @ts-ignore : Allow the value to be undefined.
    constructor(value: T = undefined) {
        if (value !== undefined) {
            this.valueInternal = value;
        }
    }

    set value(value: T) {
        if (this.isImmutable) {
            throw new Error("Flow is immutable");
        }
        if (value === undefined) {
            throw new Error("Value cannot be undefined");
        }

        this.setValueInternal(value);
    }

    get value(): T | undefined {
        if (this.valueInternal !== undefined) {
            return this.valueInternal;
        }
        const args = this.parent?.map(flow => flow.value);
        if (args === undefined) {
            return undefined;
        }
        return this.transform!(args);
    }

    private setValueInternal(value: T | undefined) {
        if (value === undefined) {
            return;
        }

        this.valueInternal = value;

        for (const observer of this.observers) {
            this.delegateValueToObserver(observer, value);
        }

        for (let [flow, observer] of this.internalObservers) {
            if (flow.hasSubscribers()) {
                this.delegateValueToObserver(observer, value);
            }
        }
    }

    /**
     * Makes the value of this flow updated when the parent flow's value changes regardless of whether this flow has
     * subscribers.
     * This method is useful when reading the current value of the flow is required rather than observing the flow.
     */
    makeValueUpdateReactively() {
        this.isValueUpdatedReactivelyRequired = true;
        // Update the value when this flag is turned on.
        // This does nothing if the value is already up-to-date, so it's safe to call this method multiple times.
        // Otherwise, this method will update the value to the latest value of the parent flow.
        this.valueInternal = this.value;
    }

    map<R>(transform: (value: T) => R): Flow<R> {
        let flow = Flow.immutable([this], transform);
        this.addInternalObserver(flow,
            new SimpleObserver((value) => {
                flow.setValueInternal(transform(value));
            })
        );
        return flow;
    }

    distinctUntilChanged(): Flow<T> {
        let flow = Flow.immutable([this], (value: T) => value);
        this.addInternalObserver(flow, new SimpleObserver((value) => {
            if (value !== flow.valueInternal && value !== undefined) {
                flow.setValueInternal(value);
            }
        }));
        return flow;
    }

    throttle(timeout: number): Flow<T> {
        if (timeout < 0) {
            return this;
        }
        const flow = Flow.immutable([this], (value: T) => value);
        this.addInternalObserver(flow, new ThrottleObserver(new SimpleObserver((value) => {
            flow.setValueInternal(value);
        }), timeout));
        return flow;
    }

    combine<T1, R>(another: Flow<T1>, transform: (value0: T, value1: T1) => R): Flow<R> {
        const transformInternal = (array: Array<unknown>): R | undefined => {
            for (const value of array) {
                if (value === undefined) {
                    return undefined;
                }
            }
            // @ts-ignore
            return transform(...array);
        }
        const parent = this;
        const flow = Flow.immutable([this, another], transformInternal);
        const observer0 = new SimpleObserver((value: T) => {
            flow.setValueInternal(transformInternal([value, another.value]));
        });
        const observer1 = new SimpleObserver((value: T1) => {
            flow.setValueInternal(transformInternal([parent.value, value]));
        });
        this.addInternalObserver(flow, observer0);
        another.addInternalObserver(flow, observer1);
        // @ts-ignore : undefined is a valid return value of transformInternal since it will be ignored by
        // setValueInternal
        return flow;
    }

    /**
     * Observe this flow.
     * The observer will be called immediately with the current value of the flow.
     * @param lifecycleOwner The lifecycle owner that the observer will be attached to. The observer will be removed
     * when the lifecycle owner is stopped. If the lifecycle owner is already not active, the observer will not be added.
     * @param observer
     */
    observe(lifecycleOwner: LifecycleOwner, observer: (value: T) => void) {
        if (!lifecycleOwner.isActive) {
            return;
        }
        let simpleObserver = new SimpleObserver(observer);
        this.observers.push(simpleObserver);
        lifecycleOwner.addObserver(new OnStopLifecycleObserver(() => {
            const index = this.observers.indexOf(simpleObserver);
            if (index !== -1) {
                this.observers.splice(index, 1);
            }
            if (!this.hasSubscribers()) {
                // When there are no more subscribers, we can clear the value since the parent flow will not propagate
                // its state to this flow anymore.
                this.valueInternal = undefined;
            }
        }));
        this.delegateValueToObserver(simpleObserver, this.valueInternal);
    }

    private addInternalObserver(key: Flow<unknown>, observer: Observer<T>) {
        this.internalObservers.set(key, observer);
    }

    private delegateValueToObserver(observer: Observer<T>, value: T | undefined) {
        if (value !== undefined) {
            observer.onChange(value);
        }
    }

    private hasSubscribers(): boolean {
        if (this.isValueUpdatedReactivelyRequired || this.observers.length > 0) {
            return true;
        }
        for (let child of this.internalObservers.keys()) {
            if (child.hasSubscribers()) {
                return true;
            }
        }
        return false;
    }

    /**
     * Stops receiving updates from the parent flow.
     * This method is useful when you want to stop receiving updates from the parent flow once this flow is no longer
     * used.
     */
    stopReceivingUpdates() {
        for (let parent of this.parent!) {
            parent.internalObservers.delete(this);
        }
    }
}

class OnStopLifecycleObserver implements LifecycleObserver {
    constructor(private callback: () => void) {
    }

    onStop() {
        this.callback();
    }
}