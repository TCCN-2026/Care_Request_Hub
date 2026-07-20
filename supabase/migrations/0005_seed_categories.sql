-- Starter category list. Admin-editable at runtime (activate/deactivate/
-- reorder) once the admin categories screen is built; a short list for
-- this core-loop slice rather than the full spec list.

insert into categories (name, sort_order) values
  ('Training and development', 10),
  ('Care software', 20),
  ('IT support and equipment', 30),
  ('Cleaning and infection control', 40),
  ('PPE and consumables', 50),
  ('Property maintenance', 60),
  ('Other', 999);
