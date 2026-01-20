/**
 * Dev Fake Data - Sensor Units
 * 
 * Unit definitions for telemetry sensor types.
 */

export function getSensorUnit(sensorType: string): string {
  const units: Record<string, string> = {
    me_rpm: 'RPM',
    me_load: '%',
    me_fuel_rack: 'mm',
    me_exhaust_temp_port: '°C',
    me_exhaust_temp_stbd: '°C',
    me_scav_air_press: 'bar',
    me_scav_air_temp: '°C',
    me_tc_rpm: 'RPM',
    me_tc_exhaust_temp: '°C',
    me_coolant_temp_in: '°C',
    me_coolant_temp_out: '°C',
    me_lub_oil_press: 'bar',
    me_lub_oil_temp: '°C',
    me_fuel_oil_press: 'bar',
    me_fuel_oil_temp: '°C',
    sw_cooling_temp: '°C',
    fw_cooling_temp: '°C',
    air_comp_press: 'bar',
    starting_air_press: 'bar',
    control_air_press: 'bar',
    er_temp: '°C',
    er_humidity: '%',
    me_running_hours: 'hours',
    dg_load_kw: 'kW',
    dg_load_percent: '%',
    dg_voltage: 'V',
    dg_frequency: 'Hz',
    dg_current: 'A',
    dg_power_factor: '',
    dg_exhaust_temp: '°C',
    dg_lub_oil_press: 'bar',
    dg_coolant_temp: '°C',
    dg_fuel_rack: 'mm',
    dg_running_hours: 'hours',
    gps_lat: 'degrees',
    gps_lon: 'degrees',
    sog: 'knots',
    cog: 'degrees',
  };
  return units[sensorType] ?? '';
}
