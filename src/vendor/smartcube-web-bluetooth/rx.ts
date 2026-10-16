// Stand-in for the slice of RxJS the library uses (Subject, Observable, Subscription), so vendoring it does not
// add rxjs to the app. Semantics follow RxJS where the library relies on them: values go to the subscribers present
// when `next` is called, nothing is replayed, and nothing is delivered after `complete`.

export type Observer<T> = {
    next?: (value: T) => void;
    error?: (error: unknown) => void;
    complete?: () => void;
};

export interface Subscription {
    unsubscribe(): void;
}

export interface Observable<T> {
    subscribe(observer: Observer<T> | ((value: T) => void)): Subscription;
}

export class Subject<T> implements Observable<T> {
    #observers: Observer<T>[] = [];
    #closed = false;

    /** True once completed or errored. */
    get closed(): boolean {
        return this.#closed;
    }

    subscribe(observer: Observer<T> | ((value: T) => void)): Subscription {
        const entry: Observer<T> = typeof observer === 'function' ? { next: observer } : observer;
        if (this.#closed) {
            entry.complete?.();
            return { unsubscribe: () => {} };
        }
        this.#observers.push(entry);
        return {
            unsubscribe: () => {
                this.#observers = this.#observers.filter((o) => o !== entry);
            },
        };
    }

    next(value: T): void {
        if (this.#closed) return;
        for (const observer of [...this.#observers]) {
            // One failing subscriber must not starve the others (RxJS reports these asynchronously too).
            try {
                observer.next?.(value);
            } catch (error) {
                console.error('smartcube subscriber threw', error);
            }
        }
    }

    error(error: unknown): void {
        if (this.#closed) return;
        this.#closed = true;
        const observers = this.#observers;
        this.#observers = [];
        for (const observer of observers) observer.error?.(error);
    }

    complete(): void {
        if (this.#closed) return;
        this.#closed = true;
        const observers = this.#observers;
        this.#observers = [];
        for (const observer of observers) observer.complete?.();
    }
}
