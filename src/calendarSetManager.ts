import type PeriodicNotesPlugin from "src/main";
import { get } from "svelte/store";

import { DEFAULT_FORMAT } from "./constants";
import { DEFAULT_PERIODIC_CONFIG } from "./settings";
import { createNewCalendarSet } from "./settings/utils";
import {
  granularities,
  type CalendarSet,
  type Granularity,
  type PeriodicConfig,
} from "./types";

interface IPerioditySettings {
  enabled: boolean;
  folder?: string;
  format?: string;
  template?: string;
}

interface ILegacySettings {
  showGettingStartedBanner: boolean;
  hasMigratedDailyNoteSettings: boolean;
  hasMigratedWeeklyNoteSettings: boolean;

  daily: IPerioditySettings;
  weekly: IPerioditySettings;
  monthly: IPerioditySettings;
  quarterly: IPerioditySettings;
  yearly: IPerioditySettings;
}

const DEFAULT_CALENDARSET_ID = "Default";

function isLegacySettings(settings: unknown): settings is ILegacySettings {
  const maybeLegacySettings = settings as ILegacySettings;
  return !!(
    maybeLegacySettings.daily ||
    maybeLegacySettings.weekly ||
    maybeLegacySettings.monthly ||
    maybeLegacySettings.yearly ||
    maybeLegacySettings.quarterly
  );
}

function migrateLegacySettingsToCalendarSet(settings: ILegacySettings): CalendarSet {
  const migrateConfig = (settings: ILegacySettings["daily"]) => {
    return {
      enabled: settings.enabled,
      format: settings.format || "",
      folder: settings.folder || "",
      templatePath: settings.template,
    };
  };

  return {
    id: DEFAULT_CALENDARSET_ID,
    ctime: window.moment().format(),
    day: migrateConfig(settings.daily),
    week: migrateConfig(settings.weekly),
    month: migrateConfig(settings.monthly),
    quarter: migrateConfig(settings.quarterly),
    year: migrateConfig(settings.yearly),
  };
}

export default class CalendarSetManager {
  constructor(readonly plugin: PeriodicNotesPlugin) {}

  public getFormat(granularity: Granularity): string {
    const settings = get(this.plugin.settings);
    const activeSet = settings.calendarSets.find(
      (set) => set.id === settings.activeCalendarSet
    );
    if (!activeSet) {
      throw new Error("No active calendar set found");
    }

    return activeSet[granularity]?.format || DEFAULT_FORMAT[granularity];
  }

  public getActiveSet(): string {
    return get(this.plugin.settings).activeCalendarSet;
  }

  public getActiveConfig(granularity: Granularity): PeriodicConfig {
    const settings = get(this.plugin.settings);
    const activeSet = settings.calendarSets.find(
      (set) => set.id === settings.activeCalendarSet
    );
    if (!activeSet) {
      throw new Error("No active calendar set found");
    }

    return activeSet[granularity] ?? DEFAULT_PERIODIC_CONFIG;
  }

  public getCalendarSets(): CalendarSet[] {
    const settings = get(this.plugin.settings);
    if (!settings.calendarSets || settings.calendarSets.length === 0) {
      // check for migration
      if (isLegacySettings(settings)) {
        this.plugin.settings.update(
          createNewCalendarSet(
            DEFAULT_CALENDARSET_ID,
            migrateLegacySettingsToCalendarSet(settings)
          )
        );
      } else {
        // otherwise create new default calendar set
        this.plugin.settings.update(createNewCalendarSet("Default"));
      }
    }

    return settings.calendarSets;
  }

  public getInactiveGranularities(): Granularity[] {
    const settings = get(this.plugin.settings);
    const activeSet = settings.calendarSets.find(
      (set) => set.id === settings.activeCalendarSet
    );
    if (!activeSet) {
      throw new Error("No active calendar set found");
    }
    return granularities.filter((granularity) => !activeSet[granularity]?.enabled);
  }

  public getActiveGranularities(): Granularity[] {
    const settings = get(this.plugin.settings);
    const activeSet = settings.calendarSets.find(
      (set) => set.id === settings.activeCalendarSet
    );
    if (!activeSet) {
      throw new Error("No active calendar set found");
    }
    return granularities.filter((granularity) => activeSet[granularity]?.enabled);
  }

  public renameCalendarset(calendarSetId: string, proposedName: string): void {
    if (calendarSetId === proposedName.trim()) {
      return;
    }

    if (proposedName.trim() === "") {
      throw new Error("Name required");
    }

    this.plugin.settings.update((settings) => {
      const existingSetWithName = settings.calendarSets.find(
        (c) => c.id === proposedName
      );

      if (existingSetWithName) {
        throw new Error(`A calendar set with the name '${proposedName}' already exists`);
      }

      const calendarSet = settings.calendarSets.find((c) => c.id === calendarSetId);
      if (calendarSet) {
        calendarSet.id = proposedName;
        if (settings.activeCalendarSet === calendarSetId) {
          settings.activeCalendarSet = proposedName;
        }
      }

      return settings;
    });
  }

  setActiveSet(calendarSetId: string): void {
    this.plugin.settings.update((settings) => {
      settings.activeCalendarSet = calendarSetId;
      return settings;
    });
  }
}