import type { CommandDef, OsdOnlySetting } from './types'

// ---------------------------------------------------------------------------
// NAD T748 RS-232 command table.
//
// Source of truth: the NAD TXX7 V2.x ASCII protocol family, as validated
// against the NAD T748v2 by the open-source `joopert/nad_receiver` library
// (https://github.com/joopert/nad_receiver). Every command below is part of
// that validated protocol set — nothing beyond the protocol is invented here.
//
// Operators per the protocol:  ?  query   =  set   +  increment   -  decrement
// All commands are ASCII and terminated with \r on the wire.
//
// Enumerated value labels (Power On/Off, Band AM/FM, etc.) come from the
// protocol's documented value domains. The ACTUAL set a given T748 answers is
// determined at runtime by the capability probe — anything the unit ignores is
// greyed out in the UI.
// ---------------------------------------------------------------------------

const ON_OFF = [
  { value: 'On', label: 'On' },
  { value: 'Off', label: 'Off' }
]

export const COMMANDS: CommandDef[] = [
  // ---- Main ----
  {
    id: 'main_power',
    cmd: 'Main.Power',
    label: 'Power',
    group: 'Main',
    operators: ['+', '-', '=', '?'],
    kind: 'toggle',
    values: ON_OFF,
    pollable: true,
    description: 'Receiver power (standby/on).'
  },
  {
    id: 'main_volume',
    cmd: 'Main.Volume',
    label: 'Master Volume',
    group: 'Main',
    operators: ['+', '-', '=', '?'],
    kind: 'volume',
    unit: 'dB',
    // Bounds are display hints only; the real cap is MAX_VOLUME_DB in the guard.
    min: -99,
    max: 19,
    step: 1,
    pollable: true,
    description: 'Master volume in dB. Always routed through the safety guard.'
  },
  {
    id: 'main_mute',
    cmd: 'Main.Mute',
    label: 'Mute',
    group: 'Main',
    operators: ['+', '-', '=', '?'],
    kind: 'toggle',
    values: ON_OFF,
    pollable: true
  },
  {
    id: 'main_source',
    cmd: 'Main.Source',
    label: 'Source',
    group: 'Main',
    operators: ['+', '-', '=', '?'],
    kind: 'enum',
    // The protocol addresses sources by number 1..12. Names are unit-configured
    // and not carried over this command, so numbers are shown.
    values: Array.from({ length: 12 }, (_, i) => ({
      value: String(i + 1),
      label: `Source ${i + 1}`
    })),
    pollable: true,
    description: 'Input source 1–12.'
  },
  {
    id: 'main_listeningmode',
    cmd: 'Main.ListeningMode',
    label: 'Listening Mode',
    group: 'Main',
    operators: ['+', '-'],
    kind: 'cycle',
    pollable: false,
    description: 'Cycle DSP/listening mode. Protocol exposes step only (+/-), no query.'
  },
  {
    id: 'main_dimmer',
    cmd: 'Main.Dimmer',
    label: 'Display Dimmer',
    group: 'Main',
    operators: ['+', '-', '=', '?'],
    kind: 'stepper',
    min: 0,
    max: 3,
    step: 1,
    pollable: true,
    description: 'Front-panel display brightness level.'
  },
  {
    id: 'main_sleep',
    cmd: 'Main.Sleep',
    label: 'Sleep Timer',
    group: 'Main',
    operators: ['+', '-'],
    kind: 'cycle',
    pollable: false,
    description: 'Cycle sleep timer. Protocol exposes step only (+/-), no query.'
  },
  {
    id: 'main_speaker_a',
    cmd: 'Main.SpeakerA',
    label: 'Speaker A',
    group: 'Main',
    operators: ['+', '-', '=', '?'],
    kind: 'toggle',
    values: ON_OFF,
    pollable: true
  },
  {
    id: 'main_speaker_b',
    cmd: 'Main.SpeakerB',
    label: 'Speaker B',
    group: 'Main',
    operators: ['+', '-', '=', '?'],
    kind: 'toggle',
    values: ON_OFF,
    pollable: true
  },
  {
    id: 'main_tape1',
    cmd: 'Main.Tape1',
    label: 'Tape Monitor',
    group: 'Main',
    operators: ['+', '-', '=', '?'],
    kind: 'toggle',
    values: ON_OFF,
    pollable: true
  },
  {
    id: 'main_model',
    cmd: 'Main.Model',
    label: 'Model',
    group: 'Info',
    operators: ['?'],
    kind: 'readonly',
    pollable: true
  },
  {
    id: 'main_version',
    cmd: 'Main.Version',
    label: 'Firmware Version',
    group: 'Info',
    operators: ['?'],
    kind: 'readonly',
    pollable: true
  },
  {
    id: 'main_ir',
    cmd: 'Main.IR',
    label: 'Send IR Remote Code',
    group: 'Advanced',
    operators: ['='],
    kind: 'ir',
    pollable: false,
    description: 'Emulate a remote-control key by sending its IR code (Main.IR=<code>).'
  },

  // ---- Tuner ----
  {
    id: 'tuner_band',
    cmd: 'Tuner.Band',
    label: 'Tuner Band',
    group: 'Tuner',
    operators: ['+', '-', '=', '?'],
    kind: 'enum',
    values: [
      { value: 'FM', label: 'FM' },
      { value: 'AM', label: 'AM' }
    ],
    pollable: true
  },
  {
    id: 'tuner_fm_frequency',
    cmd: 'Tuner.FM.Frequency',
    label: 'FM Frequency',
    group: 'Tuner',
    operators: ['+', '-'],
    kind: 'cycle',
    unit: 'MHz',
    pollable: false,
    description: 'Tune FM up/down. Protocol exposes step only (+/-).'
  },
  {
    id: 'tuner_fm_preset',
    cmd: 'Tuner.FM.Preset',
    label: 'FM Preset',
    group: 'Tuner',
    operators: ['+', '-', '=', '?'],
    kind: 'stepper',
    min: 1,
    max: 40,
    step: 1,
    pollable: true
  },
  {
    id: 'tuner_fm_mute',
    cmd: 'Tuner.FM.Mute',
    label: 'FM Mute',
    group: 'Tuner',
    operators: ['+', '-', '=', '?'],
    kind: 'toggle',
    values: ON_OFF,
    pollable: true
  },
  {
    id: 'tuner_am_frequency',
    cmd: 'Tuner.AM.Frequency',
    label: 'AM Frequency',
    group: 'Tuner',
    operators: ['+', '-'],
    kind: 'cycle',
    unit: 'kHz',
    pollable: false,
    description: 'Tune AM up/down. Protocol exposes step only (+/-).'
  },
  {
    id: 'tuner_am_preset',
    cmd: 'Tuner.AM.Preset',
    label: 'AM Preset',
    group: 'Tuner',
    operators: ['+', '-', '=', '?'],
    kind: 'stepper',
    min: 1,
    max: 40,
    step: 1,
    pollable: true
  }
]

export const POLLABLE_COMMANDS = COMMANDS.filter((c) => c.pollable)

export function commandById(id: string): CommandDef | undefined {
  return COMMANDS.find((c) => c.id === id)
}

// ---------------------------------------------------------------------------
// OSD-only settings: present on the receiver's on-screen menu / front panel but
// NOT reachable over the RS-232 protocol. Shown to the user verbatim so they
// know exactly what still requires the TV. (Honest-coverage rule.)
// ---------------------------------------------------------------------------
export const OSD_ONLY_SETTINGS: OsdOnlySetting[] = [
  {
    label: 'Speaker configuration (size / Small-Large, crossover frequency)',
    group: 'Speaker Setup',
    note: 'Bass-management settings are set in the on-screen Speaker Setup menu.'
  },
  {
    label: 'Speaker channel levels & distances (calibration)',
    group: 'Speaker Setup',
    note: 'Per-channel trim and distance are OSD/auto-calibration only.'
  },
  {
    label: 'Subwoofer crossover / LFE setup',
    group: 'Speaker Setup',
    note: 'Configured via the on-screen menu.'
  },
  {
    label: 'Tone controls (Bass / Treble) & Tone Defeat',
    group: 'Audio',
    note: 'The TXX7 V2 RS-232 set validated for the T748 does not expose tone controls; use the OSD.'
  },
  {
    label: 'Lip-sync / audio delay',
    group: 'Audio',
    note: 'A/V sync delay is an on-screen setting.'
  },
  {
    label: 'Source naming, input assignment, trigger assignment',
    group: 'Setup',
    note: 'Source/input configuration is done on-screen; only source selection (1–12) is on RS-232.'
  },
  {
    label: 'Zone 2 setup & routing',
    group: 'Zone',
    note: 'Zone configuration is not in the validated T748 RS-232 set; use the OSD.'
  },
  {
    label: 'Video / OSD / display setup',
    group: 'Video',
    note: 'Video and OSD options are on-screen only.'
  },
  {
    label: 'Tuner station naming / RDS display',
    group: 'Tuner',
    note: 'Station naming is OSD-only; RS-232 exposes band, frequency step, preset and mute.'
  }
]
