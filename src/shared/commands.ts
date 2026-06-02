import type { CommandDef, EnumValue, Operator, OsdOnlySetting } from './types'

// ---------------------------------------------------------------------------
// NAD RS-232 command table — FULL TXX7 V2.x ASCII protocol.
//
// Source of truth: NAD's official protocol pack (docs/nad-protocol/), in
// particular T787_Commands.pdf and nad_ethernet_rs232_spec_2.03.pdf. This is
// the complete variable set the protocol family defines (~200 variables).
//
// The NAD T748 / T748 V2 implements a SUBSET of this — it lacks the modules
// (VM200 video, AM200 Audyssey, iPod dock) and extra zones some bigger models
// have. Exactly which variables a given T748 answers is determined at RUNTIME
// by the capability probe: every queryable variable is asked, and the ones the
// unit ignores are greyed out / hidden. So we expose the whole protocol and let
// the device tell us what it supports — nothing is invented beyond the protocol.
//
// Operators:  ?  query   =  set   +  increment   -  decrement
// All commands are ASCII, terminated with \r on the wire.
// ---------------------------------------------------------------------------

const RW: Operator[] = ['=', '+', '-', '?']
const RO: Operator[] = ['?']

const vals = (...xs: string[]): EnumValue[] => xs.map((x) => ({ value: x, label: x }))
const numVals = (lo: number, hi: number): EnumValue[] =>
  Array.from({ length: hi - lo + 1 }, (_, i) => ({ value: String(lo + i), label: String(lo + i) }))

/** Build a CommandDef, deriving `pollable` from whether '?' is supported. */
function C(o: Omit<CommandDef, 'pollable'>): CommandDef {
  return { ...o, pollable: o.operators.includes('?') }
}

const SPEAKER_CHANNELS = [
  ['BackLeft', 'Back Left'],
  ['BackRight', 'Back Right'],
  ['Center', 'Center'],
  ['Left', 'Front Left'],
  ['Right', 'Front Right'],
  ['Sub', 'Subwoofer'],
  ['SurroundLeft', 'Surround Left'],
  ['SurroundRight', 'Surround Right']
] as const

const baseCommands: CommandDef[] = [
  // ---------------- Main ----------------
  C({ id: 'main_power', cmd: 'Main.Power', label: 'Power', group: 'Main', operators: RW, kind: 'toggle', values: vals('On', 'Off'), description: 'Receiver power (standby/on).' }),
  C({ id: 'main_volume', cmd: 'Main.Volume', label: 'Master Volume', group: 'Main', operators: RW, kind: 'volume', unit: 'dB', min: -99, max: 19, step: 1, description: 'Master volume in dB. Always routed through the safety guard.' }),
  C({ id: 'main_mute', cmd: 'Main.Mute', label: 'Mute', group: 'Main', operators: RW, kind: 'toggle', values: vals('On', 'Off') }),
  C({ id: 'main_source', cmd: 'Main.Source', label: 'Source', group: 'Main', operators: RW, kind: 'enum', values: numVals(1, 10), description: 'Active input source.' }),
  C({ id: 'main_dimmer', cmd: 'Main.Dimmer', label: 'Display Dimmer', group: 'Main', operators: RW, kind: 'toggle', values: vals('On', 'Off'), description: 'Front-panel display dimmer.' }),
  C({ id: 'main_sleep', cmd: 'Main.Sleep', label: 'Sleep Timer', group: 'Main', operators: RW, kind: 'stepper', min: 0, max: 90, step: 15, unit: 'min' }),
  C({ id: 'main_model', cmd: 'Main.Model', label: 'Model', group: 'Info', operators: RO, kind: 'readonly' }),
  C({ id: 'main_version', cmd: 'Main.Version', label: 'Main MCU Version', group: 'Info', operators: RO, kind: 'readonly' }),
  C({ id: 'dsp_version', cmd: 'DSP.Version', label: 'DSP Version', group: 'Info', operators: RO, kind: 'readonly' }),
  C({ id: 'uart_version', cmd: 'UART.Version', label: 'UART Version', group: 'Info', operators: RO, kind: 'readonly' }),

  // Speakers A/B + tape monitor (Tape1 validated on the T748v2; not in T787 list)
  C({ id: 'main_speaker_a', cmd: 'Main.SpeakerA', label: 'Speaker A', group: 'Speakers', operators: RW, kind: 'toggle', values: vals('On', 'Off') }),
  C({ id: 'main_speaker_b', cmd: 'Main.SpeakerB', label: 'Speaker B', group: 'Speakers', operators: RW, kind: 'toggle', values: vals('On', 'Off') }),
  C({ id: 'main_tape1', cmd: 'Main.Tape1', label: 'Tape Monitor', group: 'Speakers', operators: RW, kind: 'toggle', values: vals('On', 'Off'), description: 'Validated on the T748v2; may not exist on other models.' }),

  // Tone / audio
  C({ id: 'main_bass', cmd: 'Main.Bass', label: 'Bass', group: 'Tone', operators: RW, kind: 'stepper', min: -10, max: 10, step: 2, unit: 'dB' }),
  C({ id: 'main_treble', cmd: 'Main.Treble', label: 'Treble', group: 'Tone', operators: RW, kind: 'stepper', min: -10, max: 10, step: 2, unit: 'dB' }),
  C({ id: 'main_centerdialog', cmd: 'Main.CenterDialog', label: 'Center Dialog', group: 'Tone', operators: RW, kind: 'stepper', min: -6, max: 6, step: 2, unit: 'dB' }),
  C({ id: 'main_tonedefeat', cmd: 'Main.ToneDefeat', label: 'Tone Defeat', group: 'Tone', operators: RW, kind: 'toggle', values: vals('On', 'Off') }),
  C({ id: 'main_enhancedbass', cmd: 'Main.EnhancedBass', label: 'Enhanced Bass', group: 'Tone', operators: RW, kind: 'toggle', values: vals('On', 'Off') }),
  C({ id: 'main_lipsync', cmd: 'Main.LipSyncDelay', label: 'Lip-Sync Delay', group: 'Tone', operators: RW, kind: 'stepper', min: 0, max: 120, step: 5, unit: 'ms' }),

  // Audyssey (AM200 module)
  C({ id: 'main_audyssey', cmd: 'Main.Audyssey', label: 'Audyssey Curve', group: 'Audyssey', operators: RW, kind: 'enum', values: vals('Audyssey', 'Flat', 'NAD', 'Off') }),
  C({ id: 'main_audyssey_adv', cmd: 'Main.Audyssey.ADV', label: 'Audyssey Dynamic Volume', group: 'Audyssey', operators: RW, kind: 'enum', values: vals('Off', 'Light', 'Medium', 'Heavy'), description: 'AM200 module only.' }),
  C({ id: 'main_audyssey_deq', cmd: 'Main.Audyssey.DEQ', label: 'Audyssey Dynamic EQ', group: 'Audyssey', operators: RW, kind: 'toggle', values: vals('On', 'Off'), description: 'AM200 module only.' }),
  C({ id: 'main_audyssey_offset', cmd: 'Main.Audyssey.Offset', label: 'Dynamic EQ Offset', group: 'Audyssey', operators: RW, kind: 'stepper', min: 0, max: 15, step: 1, description: 'AM200 module only.' }),

  // Dolby / DTS
  C({ id: 'main_dolby_centerwidth', cmd: 'Main.Dolby.CenterWidth', label: 'Dolby Center Width', group: 'Dolby / DTS', operators: RW, kind: 'stepper', min: 0, max: 7, step: 1 }),
  C({ id: 'main_dolby_dimension', cmd: 'Main.Dolby.Dimension', label: 'Dolby Dimension', group: 'Dolby / DTS', operators: RW, kind: 'stepper', min: -7, max: 7, step: 1 }),
  C({ id: 'main_dolby_drc', cmd: 'Main.Dolby.DRC', label: 'Dolby DRC', group: 'Dolby / DTS', operators: RW, kind: 'stepper', min: 25, max: 100, step: 25, unit: '%' }),
  C({ id: 'main_dolby_panorama', cmd: 'Main.Dolby.Panorama', label: 'Dolby Panorama', group: 'Dolby / DTS', operators: RW, kind: 'toggle', values: vals('On', 'Off') }),
  C({ id: 'main_dts_centergain', cmd: 'Main.DTS.CenterGain', label: 'DTS Center Gain', group: 'Dolby / DTS', operators: RW, kind: 'enum', values: vals('0', '0.1', '0.2', '0.3', '0.4', '0.5') }),
  C({ id: 'main_dts_drc', cmd: 'Main.DTS.DRC', label: 'DTS DRC', group: 'Dolby / DTS', operators: RW, kind: 'stepper', min: 25, max: 100, step: 25, unit: '%' }),

  // Enhanced stereo speaker selection
  C({ id: 'main_es_front', cmd: 'Main.EnhancedStereo.Front', label: 'Enh. Stereo: Front', group: 'Enhanced Stereo', operators: RW, kind: 'toggle', values: vals('On', 'Off') }),
  C({ id: 'main_es_center', cmd: 'Main.EnhancedStereo.Center', label: 'Enh. Stereo: Center', group: 'Enhanced Stereo', operators: RW, kind: 'toggle', values: vals('On', 'Off') }),
  C({ id: 'main_es_surround', cmd: 'Main.EnhancedStereo.Surround', label: 'Enh. Stereo: Surround', group: 'Enhanced Stereo', operators: RW, kind: 'toggle', values: vals('On', 'Off') }),
  C({ id: 'main_es_back', cmd: 'Main.EnhancedStereo.Back', label: 'Enh. Stereo: Back', group: 'Enhanced Stereo', operators: RW, kind: 'toggle', values: vals('On', 'Off') }),

  // Listening modes
  C({ id: 'main_listeningmode', cmd: 'Main.ListeningMode', label: 'Listening Mode (active)', group: 'Listening Modes', operators: RW, kind: 'enum', values: vals('None', 'PLIIMovie', 'PLIIMusic', 'ProLogic', 'NEO6Music', 'NEO6Cinema', 'EARS', 'EnhancedStereo', 'AnalogBypass', 'StereoDownmix', 'SurroundEX') }),
  C({ id: 'main_lm_analog', cmd: 'Main.ListeningMode.Analog', label: 'Default: Analog', group: 'Listening Modes', operators: RW, kind: 'enum', values: vals('None', 'PLIIMusic', 'PLIIMovie', 'ProLogic', 'NEO6Music', 'NEO6Cinema', 'EARS', 'EnhancedStereo', 'AnalogBypass') }),
  C({ id: 'main_lm_digital', cmd: 'Main.ListeningMode.Digital', label: 'Default: Digital', group: 'Listening Modes', operators: RW, kind: 'enum', values: vals('None', 'PLIIMusic', 'PLIIMovie', 'ProLogic', 'NEO6Music', 'NEO6Cinema', 'EARS', 'EnhancedStereo', 'StereoDownmix') }),
  C({ id: 'main_lm_dd', cmd: 'Main.ListeningMode.DolbyDigital', label: 'Default: Dolby Digital', group: 'Listening Modes', operators: RW, kind: 'enum', values: vals('None', 'PLIIMovie', 'PLIIMusic', 'SurroundEX', 'StereoDownmix') }),
  C({ id: 'main_lm_dd2', cmd: 'Main.ListeningMode.DolbyDigital2ch', label: 'Default: Dolby Digital 2ch', group: 'Listening Modes', operators: RW, kind: 'enum', values: vals('None', 'PLIIMovie', 'PLIIMusic', 'ProLogic') }),
  C({ id: 'main_lm_dts', cmd: 'Main.ListeningMode.DTS', label: 'Default: DTS', group: 'Listening Modes', operators: RW, kind: 'enum', values: vals('None', 'NEO6Music', 'StereoDownmix') }),

  // Speaker configuration
  C({ id: 'spk_front_config', cmd: 'Main.Speaker.Front.Config', label: 'Front Size', group: 'Speaker Setup', operators: RW, kind: 'enum', values: vals('Small', 'Large') }),
  C({ id: 'spk_front_freq', cmd: 'Main.Speaker.Front.Frequency', label: 'Front Crossover', group: 'Speaker Setup', operators: RW, kind: 'stepper', min: 40, max: 200, step: 10, unit: 'Hz' }),
  C({ id: 'spk_center_config', cmd: 'Main.Speaker.Center.Config', label: 'Center Size', group: 'Speaker Setup', operators: RW, kind: 'enum', values: vals('Large', 'Small', 'Off') }),
  C({ id: 'spk_center_freq', cmd: 'Main.Speaker.Center.Frequency', label: 'Center Crossover', group: 'Speaker Setup', operators: RW, kind: 'stepper', min: 40, max: 200, step: 10, unit: 'Hz' }),
  C({ id: 'spk_surround_config', cmd: 'Main.Speaker.Surround.Config', label: 'Surround Size', group: 'Speaker Setup', operators: RW, kind: 'enum', values: vals('Large', 'Small', 'Off') }),
  C({ id: 'spk_surround_freq', cmd: 'Main.Speaker.Surround.Frequency', label: 'Surround Crossover', group: 'Speaker Setup', operators: RW, kind: 'stepper', min: 40, max: 200, step: 10, unit: 'Hz' }),
  C({ id: 'spk_back_config1', cmd: 'Main.Speaker.Back.Config1', label: 'Back Speakers (count)', group: 'Speaker Setup', operators: RW, kind: 'stepper', min: 0, max: 2, step: 1 }),
  C({ id: 'spk_back_config2', cmd: 'Main.Speaker.Back.Config2', label: 'Back Size', group: 'Speaker Setup', operators: RW, kind: 'enum', values: vals('Large', 'Small') }),
  C({ id: 'spk_back_freq', cmd: 'Main.Speaker.Back.Frequency', label: 'Back Crossover', group: 'Speaker Setup', operators: RW, kind: 'stepper', min: 40, max: 200, step: 10, unit: 'Hz' }),
  C({ id: 'spk_sub', cmd: 'Main.Speaker.Sub', label: 'Subwoofer', group: 'Speaker Setup', operators: RW, kind: 'toggle', values: vals('On', 'Off') }),

  // Distance / UOM
  ...SPEAKER_CHANNELS.filter(([k]) => k !== 'Sub').map(([k, lbl]) =>
    C({ id: `dist_${k.toLowerCase()}`, cmd: `Main.Distance.${k}`, label: `Distance: ${lbl}`, group: 'Speaker Distances', operators: RW, kind: 'stepper', min: 0, max: 30, step: 1 })
  ),
  C({ id: 'dist_sub', cmd: 'Main.Distance.Sub', label: 'Distance: Subwoofer', group: 'Speaker Distances', operators: RW, kind: 'stepper', min: 0, max: 30, step: 1 }),
  C({ id: 'dist_uom', cmd: 'Main.Distance.UOM', label: 'Distance Units', group: 'Speaker Distances', operators: RW, kind: 'enum', values: vals('Feet', 'Meters') }),

  // Channel levels
  ...SPEAKER_CHANNELS.map(([k, lbl]) =>
    C({ id: `level_${k.toLowerCase()}`, cmd: `Main.Level.${k}`, label: `Level: ${lbl}`, group: 'Speaker Levels', operators: RW, kind: 'stepper', min: -12, max: 12, step: 1, unit: 'dB' })
  ),
  // Trim (temporary levels)
  C({ id: 'trim_center', cmd: 'Main.Trim.Center', label: 'Trim: Center', group: 'Speaker Levels', operators: RW, kind: 'stepper', min: -6, max: 6, step: 1, unit: 'dB' }),
  C({ id: 'trim_surround', cmd: 'Main.Trim.Surround', label: 'Trim: Surround', group: 'Speaker Levels', operators: RW, kind: 'stepper', min: -6, max: 6, step: 1, unit: 'dB' }),
  C({ id: 'trim_sub', cmd: 'Main.Trim.Sub', label: 'Trim: Subwoofer', group: 'Speaker Levels', operators: RW, kind: 'stepper', min: -6, max: 6, step: 1, unit: 'dB' }),

  // Triggers
  C({ id: 'main_autotrigger', cmd: 'Main.AutoTrigger', label: 'Auto Trigger Input', group: 'Triggers', operators: RW, kind: 'enum', values: vals('Main', 'All', 'Zone2', 'Zone3', 'Zone4') }),
  ...[1, 2, 3].flatMap((n) => [
    C({ id: `trigger${n}_out`, cmd: `Main.Trigger${n}.Out`, label: `Trigger ${n} Output`, group: 'Triggers', operators: RW, kind: 'enum', values: vals('Main', 'Source', 'Zone2', 'Zone3', 'Zone4', 'Zone234') }),
    C({ id: `trigger${n}_delay`, cmd: `Main.Trigger${n}.Delay`, label: `Trigger ${n} Delay`, group: 'Triggers', operators: RW, kind: 'stepper', min: 0, max: 15, step: 1, unit: 's' })
  ]),

  // CEC / control
  C({ id: 'cec_power', cmd: 'Main.CEC.Power', label: 'CEC Power', group: 'System', operators: RW, kind: 'toggle', values: vals('On', 'Off') }),
  C({ id: 'cec_switch', cmd: 'Main.CEC.Switch', label: 'CEC Source Switch', group: 'System', operators: RW, kind: 'toggle', values: vals('On', 'Off') }),
  C({ id: 'cec_audio', cmd: 'Main.CEC.Audio', label: 'CEC Audio', group: 'System', operators: RW, kind: 'toggle', values: vals('On', 'Off') }),
  C({ id: 'cec_arc', cmd: 'Main.CEC.Arc', label: 'CEC ARC', group: 'System', operators: RW, kind: 'enum', values: vals('Off', 'Auto', 'SourceSetup') }),
  C({ id: 'control_standby', cmd: 'Main.ControlStandby', label: 'Control when Standby', group: 'System', operators: RW, kind: 'toggle', values: vals('On', 'Off') }),
  C({ id: 'amp_back', cmd: 'Main.Amp.Back', label: 'Back Amp Assignment', group: 'System', operators: RW, kind: 'enum', values: vals('Back', 'Front', 'Zone2', 'Zone3', 'Zone4') }),

  // Display (VFD)
  C({ id: 'vfd_display', cmd: 'Main.VFD.Display', label: 'VFD Display', group: 'Display (VFD)', operators: RW, kind: 'enum', values: vals('On', 'Temp') }),
  C({ id: 'vfd_line1', cmd: 'Main.VFD.Line1', label: 'VFD Line 1', group: 'Display (VFD)', operators: RW, kind: 'enum', values: vals('Off', 'MainSource', 'Volume', 'ListeningMode', 'AudioSourceFormat', 'Zone2Source', 'Zone3Source', 'Zone4Source') }),
  C({ id: 'vfd_line2', cmd: 'Main.VFD.Line2', label: 'VFD Line 2', group: 'Display (VFD)', operators: RW, kind: 'enum', values: vals('Off', 'MainSource', 'Volume', 'ListeningMode', 'AudioSourceFormat', 'Zone2Source', 'Zone3Source', 'Zone4Source') }),
  C({ id: 'vfd_templine', cmd: 'Main.VFD.TempLine', label: 'VFD Temp Line', group: 'Display (VFD)', operators: RW, kind: 'stepper', min: 1, max: 2, step: 1 }),
  C({ id: 'osd_tempdisplay', cmd: 'Main.OSD.TempDisplay', label: 'OSD Temp Display', group: 'Display (VFD)', operators: RW, kind: 'toggle', values: vals('On', 'Off') }),

  // Video (VM200 module)
  C({ id: 'main_videomode', cmd: 'Main.VideoMode', label: 'Video Mode', group: 'Video (VM200)', operators: RW, kind: 'enum', values: vals('NTSC', 'PAL') }),
  C({ id: 'video_aspect_mode', cmd: 'Main.Video.Aspect.Mode', label: 'Aspect Mode', group: 'Video (VM200)', operators: RW, kind: 'enum', values: vals('Zoom', 'Stretch', 'LetterBox') }),
  C({ id: 'video_aspect_ratio', cmd: 'Main.Video.Aspect.Ratio', label: 'Aspect Ratio', group: 'Video (VM200)', operators: RW, kind: 'enum', values: vals('4:3', '16:9') }),
  C({ id: 'video_brightness', cmd: 'Main.Video.Brightness', label: 'Brightness', group: 'Video (VM200)', operators: RW, kind: 'stepper', min: 0, max: 100, step: 5 }),
  C({ id: 'video_contrast', cmd: 'Main.Video.Contrast', label: 'Contrast', group: 'Video (VM200)', operators: RW, kind: 'stepper', min: 0, max: 100, step: 5 }),
  C({ id: 'video_ee_level', cmd: 'Main.Video.EdgeEnhancement.Level', label: 'Edge Enhancement Level', group: 'Video (VM200)', operators: RW, kind: 'stepper', min: 0, max: 100, step: 5 }),
  C({ id: 'video_ee_thr', cmd: 'Main.Video.EdgeEnhancement.Treshold', label: 'Edge Enhancement Threshold', group: 'Video (VM200)', operators: RW, kind: 'stepper', min: 0, max: 100, step: 5 }),
  C({ id: 'video_nr', cmd: 'Main.Video.NoiseReduction', label: 'Noise Reduction', group: 'Video (VM200)', operators: RW, kind: 'stepper', min: 0, max: 50, step: 5 }),
  C({ id: 'video_rate', cmd: 'Main.Video.Rate', label: 'Output Rate', group: 'Video (VM200)', operators: RW, kind: 'enum', values: vals('60', '50') }),
  C({ id: 'video_resolution', cmd: 'Main.Video.Resolution', label: 'Output Resolution', group: 'Video (VM200)', operators: RW, kind: 'enum', values: vals('480i', '480p', '576i', '576p', '720p', '1080i', '1080p') }),

  // IR
  C({ id: 'main_ir', cmd: 'Main.IR', label: 'Send IR Remote Code', group: 'Advanced', operators: ['='], kind: 'ir', description: 'Emulate a remote key (decimal IR code).' }),
  C({ id: 'main_ir_channel', cmd: 'Main.IR.Channel', label: 'IR Channel', group: 'Advanced', operators: RW, kind: 'stepper', min: 0, max: 1, step: 1, description: 'Lets two NADs be controlled separately.' }),

  // ---------------- iPod (IPD dock) ----------------
  C({ id: 'ipod_album', cmd: 'Ipod.Album', label: 'Album', group: 'iPod', operators: RO, kind: 'readonly' }),
  C({ id: 'ipod_artist', cmd: 'Ipod.Artist', label: 'Artist', group: 'iPod', operators: RO, kind: 'readonly' }),
  C({ id: 'ipod_title', cmd: 'Ipod.Title', label: 'Track Title', group: 'iPod', operators: RO, kind: 'readonly' }),
  C({ id: 'ipod_track', cmd: 'Ipod.Track', label: 'Track', group: 'iPod', operators: ['+', '-'], kind: 'cycle' }),
  C({ id: 'ipod_playmode', cmd: 'Ipod.PlayMode', label: 'Play Mode', group: 'iPod', operators: RW, kind: 'enum', values: vals('Play', 'Pause', 'FastForward', 'Rewind') }),
  C({ id: 'ipod_repeat', cmd: 'Ipod.Repeat', label: 'Repeat', group: 'iPod', operators: RW, kind: 'enum', values: vals('Off', 'One', 'All') }),
  C({ id: 'ipod_shuffle', cmd: 'Ipod.Shuffle', label: 'Shuffle', group: 'iPod', operators: RW, kind: 'enum', values: vals('Off', 'Songs', 'Albums') }),
  C({ id: 'ipod_enabled', cmd: 'Ipod.Enabled', label: 'iPod Interface', group: 'iPod', operators: RW, kind: 'enum', values: vals('Yes', 'No') }),
  C({ id: 'ipod_autoconnect', cmd: 'Ipod.AutoConnect', label: 'Auto Connect', group: 'iPod', operators: RW, kind: 'enum', values: vals('Yes', 'No') }),
  C({ id: 'ipod_audiobookspeed', cmd: 'Ipod.AudiobookSpeed', label: 'Audiobook Speed', group: 'iPod', operators: RW, kind: 'enum', values: vals('Slow', 'Normal', 'Fast') }),
  C({ id: 'ipod_menutimeout', cmd: 'Ipod.MenuTimeout', label: 'Menu Timeout', group: 'iPod', operators: RW, kind: 'stepper', min: 0, max: 60, step: 5, unit: 's' }),

  // ---------------- Tuner ----------------
  C({ id: 'tuner_band', cmd: 'Tuner.Band', label: 'Band', group: 'Tuner', operators: RW, kind: 'enum', values: vals('FM', 'AM', 'DAB', 'XM') }),
  C({ id: 'tuner_fm_frequency', cmd: 'Tuner.FM.Frequency', label: 'FM Frequency', group: 'Tuner', operators: RW, kind: 'stepper', unit: 'MHz', description: 'Tune up/down (value is a frequency string).' }),
  C({ id: 'tuner_am_frequency', cmd: 'Tuner.AM.Frequency', label: 'AM Frequency', group: 'Tuner', operators: RW, kind: 'stepper', unit: 'kHz', description: 'Tune up/down (value is a frequency string).' }),
  C({ id: 'tuner_amstep', cmd: 'Tuner.AMStep', label: 'AM Step', group: 'Tuner', operators: RW, kind: 'enum', values: vals('9', '10'), unit: 'kHz' }),
  C({ id: 'tuner_fm_mute', cmd: 'Tuner.FM.Mute', label: 'FM Mute (mono blend)', group: 'Tuner', operators: RW, kind: 'toggle', values: vals('On', 'Off') }),
  C({ id: 'tuner_preset', cmd: 'Tuner.Preset', label: 'Preset', group: 'Tuner', operators: RW, kind: 'stepper', min: 1, max: 40, step: 1 }),
  C({ id: 'tuner_fm_rdsname', cmd: 'Tuner.FM.RDSName', label: 'FM RDS Name', group: 'Tuner', operators: RO, kind: 'readonly' }),
  C({ id: 'tuner_fm_rdstext', cmd: 'Tuner.FM.RDSText', label: 'FM RDS Text', group: 'Tuner', operators: RO, kind: 'readonly' }),
  C({ id: 'tuner_digitalmode', cmd: 'Tuner.DigitalMode', label: 'Digital Mode', group: 'Tuner', operators: RW, kind: 'enum', values: vals('DAB', 'XM') }),
  C({ id: 'tuner_dab_dls', cmd: 'Tuner.DAB.DLS', label: 'DAB DLS Text', group: 'Tuner', operators: RO, kind: 'readonly' }),
  C({ id: 'tuner_dab_service', cmd: 'Tuner.DAB.Service', label: 'DAB Service', group: 'Tuner', operators: RO, kind: 'readonly' }),
  C({ id: 'tuner_xm_channel', cmd: 'Tuner.XM.Channel', label: 'XM Channel', group: 'Tuner', operators: RW, kind: 'stepper', min: 0, max: 255, step: 1 }),
  C({ id: 'tuner_xm_channelname', cmd: 'Tuner.XM.ChannelName', label: 'XM Channel Name', group: 'Tuner', operators: RO, kind: 'readonly' }),
  C({ id: 'tuner_xm_name', cmd: 'Tuner.XM.Name', label: 'XM Name', group: 'Tuner', operators: RO, kind: 'readonly' }),
  C({ id: 'tuner_xm_title', cmd: 'Tuner.XM.Title', label: 'XM Title', group: 'Tuner', operators: RO, kind: 'readonly' })
]

// ---------------- Source 1..10 (input configuration) ----------------
const AUDIO_FORMAT = vals('Off', 'Stereo', '7.1')
const DIGITAL_FORMAT = vals('Off', 'HDMI', 'Coaxial', 'Optical', 'ARC')
const VIDEO_FORMAT = vals('Off', 'Video', 'SVideo', 'Component', 'HDMI')
const sourceCommands: CommandDef[] = Array.from({ length: 10 }, (_, i) => i + 1).flatMap((n) => [
  C({ id: `src${n}_enabled`, cmd: `Source${n}.Enabled`, label: `Source ${n}: Enabled`, group: 'Sources', operators: RW, kind: 'enum', values: vals('Yes', 'No') }),
  C({ id: `src${n}_aaf`, cmd: `Source${n}.AnalogAudioFormat`, label: `Source ${n}: Analog Format`, group: 'Sources', operators: RW, kind: 'enum', values: AUDIO_FORMAT }),
  C({ id: `src${n}_aai`, cmd: `Source${n}.AnalogAudioInput`, label: `Source ${n}: Analog Input`, group: 'Sources', operators: RW, kind: 'stepper', min: 1, max: 8, step: 1 }),
  C({ id: `src${n}_again`, cmd: `Source${n}.AnalogGain`, label: `Source ${n}: Analog Gain`, group: 'Sources', operators: RW, kind: 'stepper', min: -12, max: 12, step: 3, unit: 'dB' }),
  C({ id: `src${n}_daf`, cmd: `Source${n}.DigitalAudioFormat`, label: `Source ${n}: Digital Format`, group: 'Sources', operators: RW, kind: 'enum', values: DIGITAL_FORMAT }),
  C({ id: `src${n}_dai`, cmd: `Source${n}.DigitalAudioInput`, label: `Source ${n}: Digital Input`, group: 'Sources', operators: RW, kind: 'stepper', min: 1, max: 8, step: 1 }),
  C({ id: `src${n}_vf`, cmd: `Source${n}.VideoFormat`, label: `Source ${n}: Video Format`, group: 'Sources', operators: RW, kind: 'enum', values: VIDEO_FORMAT }),
  C({ id: `src${n}_vi`, cmd: `Source${n}.VideoInput`, label: `Source ${n}: Video Input`, group: 'Sources', operators: RW, kind: 'stepper', min: 1, max: 8, step: 1 }),
  C({ id: `src${n}_preset`, cmd: `Source${n}.Preset`, label: `Source ${n}: Preset`, group: 'Sources', operators: RW, kind: 'stepper', min: 0, max: 5, step: 1 }),
  C({ id: `src${n}_trigger`, cmd: `Source${n}.TriggerOut`, label: `Source ${n}: Trigger Out`, group: 'Sources', operators: RW, kind: 'stepper', min: 0, max: 7, step: 1 })
])

// ---------------- Preset 1..5 (what each preset stores) ----------------
const presetCommands: CommandDef[] = Array.from({ length: 5 }, (_, i) => i + 1).flatMap((n) => [
  C({ id: `preset${n}_display`, cmd: `Preset${n}.Setup.Display`, label: `Preset ${n}: store Display`, group: 'Presets', operators: RW, kind: 'enum', values: vals('Yes', 'No') }),
  C({ id: `preset${n}_dsp`, cmd: `Preset${n}.Setup.DSPOptions`, label: `Preset ${n}: store DSP Options`, group: 'Presets', operators: RW, kind: 'enum', values: vals('Yes', 'No') }),
  C({ id: `preset${n}_lm`, cmd: `Preset${n}.Setup.ListeningMode`, label: `Preset ${n}: store Listening Mode`, group: 'Presets', operators: RW, kind: 'enum', values: vals('Yes', 'No') }),
  C({ id: `preset${n}_spk`, cmd: `Preset${n}.Setup.Speaker`, label: `Preset ${n}: store Speaker`, group: 'Presets', operators: RW, kind: 'enum', values: vals('Yes', 'No') }),
  C({ id: `preset${n}_tone`, cmd: `Preset${n}.Setup.ToneControls`, label: `Preset ${n}: store Tone`, group: 'Presets', operators: RW, kind: 'enum', values: vals('Yes', 'No') }),
  C({ id: `preset${n}_pic`, cmd: `Preset${n}.Setup.PictureControls`, label: `Preset ${n}: store Picture (VM200)`, group: 'Presets', operators: RW, kind: 'enum', values: vals('Yes', 'No') })
])

// ---------------- Zone 2..4 ----------------
const zoneCommands: CommandDef[] = [2, 3, 4].flatMap((z) => {
  const cmds: CommandDef[] = [
    C({ id: `zone${z}_power`, cmd: `Zone${z}.Power`, label: `Zone ${z}: Power`, group: 'Zones', operators: RW, kind: 'toggle', values: vals('On', 'Off') }),
    C({ id: `zone${z}_mute`, cmd: `Zone${z}.Mute`, label: `Zone ${z}: Mute`, group: 'Zones', operators: RW, kind: 'toggle', values: vals('On', 'Off') }),
    C({ id: `zone${z}_source`, cmd: `Zone${z}.Source`, label: `Zone ${z}: Source`, group: 'Zones', operators: RW, kind: 'enum', values: numVals(1, 11) }),
    // Zone volume is a SEPARATE output (other room). It does not go through the
    // main MAX_VOLUME_DB guard; only +/- stepping is offered (no absolute blast).
    C({ id: `zone${z}_volume`, cmd: `Zone${z}.Volume`, label: `Zone ${z}: Volume`, group: 'Zones', operators: RW, kind: 'stepper', min: -99, max: 19, step: 1, unit: 'dB' }),
    C({ id: `zone${z}_volctrl`, cmd: `Zone${z}.VolumeControl`, label: `Zone ${z}: Volume Mode`, group: 'Zones', operators: RW, kind: 'enum', values: vals('Variable', 'Fixed') }),
    C({ id: `zone${z}_volfixed`, cmd: `Zone${z}.VolumeFixed`, label: `Zone ${z}: Fixed Volume`, group: 'Zones', operators: RW, kind: 'stepper', min: -95, max: 16, step: 1, unit: 'dB' })
  ]
  if (z !== 2) {
    cmds.splice(0, 0, C({ id: `zone${z}_mode`, cmd: `Zone${z}.Mode`, label: `Zone ${z}: Mode`, group: 'Zones', operators: RW, kind: 'enum', values: vals('Zone', 'Record') }))
  }
  return cmds
})

export const COMMANDS: CommandDef[] = [
  ...baseCommands,
  ...sourceCommands,
  ...presetCommands,
  ...zoneCommands
]

export const POLLABLE_COMMANDS = COMMANDS.filter((c) => c.pollable)

/** Light set polled periodically so physical-remote changes show without flooding the port. */
export const LIVE_POLL_IDS = [
  'main_power',
  'main_volume',
  'main_mute',
  'main_source',
  'main_listeningmode',
  'tuner_band',
  'tuner_preset'
]

export function commandById(id: string): CommandDef | undefined {
  return COMMANDS.find((c) => c.id === id)
}

// ---------------------------------------------------------------------------
// OSD-only settings: present on the receiver but NOT reachable over RS-232.
// With the full protocol exposed, very little remains OSD-only. (Honest rule.)
// Note: whether any protocol command actually works on a given T748 is decided
// by the runtime capability probe — unsupported ones are greyed out.
// ---------------------------------------------------------------------------
export const OSD_ONLY_SETTINGS: OsdOnlySetting[] = [
  {
    label: 'Audyssey auto-calibration run (microphone measurement)',
    group: 'Setup',
    note: 'RS-232 can pick the Audyssey curve, but running the measurement sweep needs the on-screen wizard + mic.'
  },
  {
    label: 'Source names / on-screen labels',
    group: 'Setup',
    note: 'Sources are addressed by number over RS-232; renaming them is OSD-only.'
  },
  {
    label: 'Network / firmware update / region & language setup',
    group: 'System',
    note: 'Initial setup, firmware updates and language are on-screen only.'
  },
  {
    label: 'HDMI / video routing and EDID details beyond the exposed video options',
    group: 'Video',
    note: 'Some HDMI/EDID specifics are configured on-screen.'
  },
  {
    label: 'Anything your specific T748 does not answer in the capability probe',
    group: 'Model-specific',
    note: 'The full protocol is exposed; controls greyed out after a probe are not supported by this unit and remain OSD/front-panel only.'
  }
]
