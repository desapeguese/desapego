-- O livro é só de acréscimo: nem o próprio app consegue reescrever o passado.
CREATE FUNCTION transacao_imutavel() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'transacao é imutável: corrija com um estorno';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER transacao_sem_update_delete
  BEFORE UPDATE OR DELETE ON "transacao"
  FOR EACH ROW EXECUTE FUNCTION transacao_imutavel();
--> statement-breakpoint
CREATE TRIGGER transacao_sem_truncate
  BEFORE TRUNCATE ON "transacao"
  FOR EACH STATEMENT EXECUTE FUNCTION transacao_imutavel();
