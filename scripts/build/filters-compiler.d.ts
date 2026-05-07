declare module '@adguard/filters-compiler' {
    export function compile(
        filtersPath: string,
        logPath: string,
        reportPath: string,
        platformsPath: string,
        whitelist: number[],
        blacklist: number[],
        customPlatformsConfig?: Record<string, unknown>,
    ): Promise<void>;

    export const optimizationConfigLocal: {
        setPath(configPath: string): void;
        generate(configPath: string): Promise<void>;
        reset(): Promise<void>;
    };
}
