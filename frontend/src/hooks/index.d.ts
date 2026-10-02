export declare function useDebounce<T>(value: T, delayMs: number): T;
export declare function useMediaQuery(query: string): boolean;
export declare function useIsMobile(): boolean;
export declare function useIsTablet(): boolean;
export declare function useLocalStorage<T>(key: string, defaultValue: T): [T, (value: T) => void];
