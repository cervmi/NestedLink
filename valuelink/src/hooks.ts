import { useEffect, useRef, useState } from 'react';
import { helpers } from './helpers';
import { Link, LinksHash } from './link';

export class UseStateLink<T> extends Link<T> {
    // Set the component's state value.
    set( x : T | ( ( x : T ) => T ) ) : void {}

    update( fun : ( x : T, event? : Object ) => T, event? : Object ) : void {
        // update function must be overriden to use state set
        // ability to delay an update, and to preserve link.update semantic.
        this.set( x => {
            const value = helpers( x ).clone( x ),
                result = fun( value, event );

            return result === void 0 ? x : result;
        });
    }

    constructor(
        value : T,
        set : ( x : T | ( ( x : T ) => T ) ) => void
    ){
        super( value );
        this.set = set;
    }
}

/**
 * Create the link to the local state.
 */
export function useLink<S>( initialState : S | (() => S) ){
    const [ value, set ] = useState( initialState );
    return new UseStateLink( value, set );
}

/**
 * Create the link to the local state which is safe to set when component is unmounted.
 * Use this for the state which is set when async I/O is completed.
 */
export function useSafeLink<S>( initialState : S | (() => S) ){
    const [ value, set ] = useState( initialState ),
            isMounted = useIsMountedRef();

    return new UseStateLink( value, x => isMounted.current && set( x ) );
}

/**
 * Returns the ref which is true when component it mounted.
 */
export function useIsMountedRef(){
    const isMounted = useRef( true );
    
    useEffect( () => (
        () => isMounted.current = false
    ), []);

    return isMounted;
}

/**
 * Create the link to the local state which is bound to another 
 * value or link in a single direction. When the source changes, the link changes too.
 */
export function useBoundLink<T>( source : T | Link<T>) : Link<T> {
    const value = source instanceof Link ? source.value : source,
          link = useLink( value );

    useEffect(() => link.set( value ), [ value ]);

    link.action
    return link;
}

/**
 * Create the safe link to the local state which is synchronized with another 
 * value or link in a single direction.
 * When the source change, the linked state changes too.
 */
export function useSafeBoundLink<T>( source : T ) : Link<T> {
    const value = source instanceof Link ? source.value : source,
          link = useSafeLink( value );
 
    useEffect(() => link.set( value ), [ value ]);

    return link;
}

/**
 * Persists links in local storage under the given key. 
 * Links will be loaded on component's mount, and saved on unmount.
 * @param key - string key for the localStorage entry.
 * @param state - links to persist wrapped in an object `{ lnk1, lnk2, ... }`
 */
export function useLocalStorage( key : string, state : LinksHash ){
    // save state to use on unmount...
    const stateRef = useRef<LinksHash>();
    stateRef.current = state;

    useEffect(()=>{
        const savedData = JSON.parse( localStorage.getItem( key ) || '{}' );
        Link.setValues( stateRef.current, savedData );

        return () =>{
            const dataToSave = Link.getValues( stateRef.current );
            localStorage.setItem( key, JSON.stringify( dataToSave ) );
        }
    },[]);
}

/**
 * Wait for the promise (or async function) completion.
 * Execute operation once when mounted, returning `null` while the operation is pending.
 * When operation is completed, returns "ok" or "fail" depending on the result and 
 * forces the local component update.
 * 
 * const isReady = useIO( async () => {
 *      const data = await fetchData();
 *      link.set( data );
 * });
 */
export function useIO( fun : () => Promise<any>, condition : any[] = [] ) : boolean {
    // Counter of open I/O requests. If it's 0, I/O is completed.
    // Counter is needed to handle the situation when the next request
    // is issued before the previous one was completed.
    const $isReady = useSafeLink<number>( null );

    useEffect(()=>{
        // function in set instead of value to avoid race conditions with counter increment.
        $isReady.set( x => ( x || 0 ) + 1 );

        fun().finally(() => $isReady.set( x => x - 1 ));
    }, condition);

    // null is used to detect the first render when no requests issued yet
    // but the I/O is not completed.
    return $isReady.value === null ? false : !$isReady.value;
}