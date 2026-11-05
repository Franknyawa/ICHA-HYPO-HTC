-- Journal des modifications (visible par le super admin seulement).
CREATE TABLE IF NOT EXISTS journal_modifications (
  id          text PRIMARY KEY,
  created_at  timestamp(3) NOT NULL DEFAULT now(),
  user_id     text,
  user_nom    text NOT NULL,
  role        text NOT NULL,
  action      text NOT NULL,
  libelle     text NOT NULL,
  entite_type text,
  entite_id   text,
  resume      text,
  details     jsonb,
  methode     text NOT NULL,
  chemin      text NOT NULL
);
CREATE INDEX IF NOT EXISTS journal_modifications_created_at_idx ON journal_modifications (created_at);
CREATE INDEX IF NOT EXISTS journal_modifications_user_id_idx ON journal_modifications (user_id);
CREATE INDEX IF NOT EXISTS journal_modifications_action_idx ON journal_modifications (action);
CREATE INDEX IF NOT EXISTS journal_modifications_entite_type_idx ON journal_modifications (entite_type);
