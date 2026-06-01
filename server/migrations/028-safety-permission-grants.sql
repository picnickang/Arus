-- Split safety alarm operation from alarm-type configuration.
-- Existing role rows receive conservative defaults; organizations can tighten
-- or expand these through the permission management UI.

INSERT INTO permission_grants (role_id, resource_code, action_code, is_granted)
SELECT id, 'safety_alarms', action_code, true
FROM roles
CROSS JOIN (
  VALUES ('view'), ('trigger'), ('clear'), ('acknowledge'), ('export')
) AS actions(action_code)
WHERE name IN ('system_admin', 'company_admin', 'admin', 'captain', 'chief_engineer', 'fleet_manager')
ON CONFLICT (role_id, resource_code, action_code) DO NOTHING;

INSERT INTO permission_grants (role_id, resource_code, action_code, is_granted)
SELECT id, 'safety_alarm_types', 'view', true
FROM roles
WHERE name IN ('system_admin', 'company_admin', 'admin', 'captain', 'chief_engineer', 'fleet_manager')
ON CONFLICT (role_id, resource_code, action_code) DO NOTHING;

INSERT INTO permission_grants (role_id, resource_code, action_code, is_granted)
SELECT id, 'safety_alarm_types', 'manage', true
FROM roles
WHERE name IN ('system_admin', 'company_admin', 'admin')
ON CONFLICT (role_id, resource_code, action_code) DO NOTHING;

