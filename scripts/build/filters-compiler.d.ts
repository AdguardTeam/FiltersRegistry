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

    export const localOptimizationConfig: {
        downloadPercentJson(configPath: string): Promise<void>;
        downloadStatsFromPercentJson(configPath: string): Promise<void>;
        reset(configPath: string): Promise<void>;
    };
}
