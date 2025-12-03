# AI_NOTES.md

## Instrucao para IA
- Sempre iniciar lendo este arquivo e o map.txt para contexto. Comando rapido: `Get-Content AI_NOTES.md; Get-Content map.txt`.
- Nao criar novas migrations; sincronizar qualquer alteracao de schema diretamente em `docker/db/init.sql` (migracoes existentes ja foram incorporadas).
- Toda alteracao de codigo/funcionalidade deve atualizar AI_NOTES.md e map.txt (arquitetura, fluxos, comandos).
- Mensagens ao usuario (erro/sucesso/aviso/info) sempre via ToastProvider (toast.error/success/info). Nao usar alert ou logs em vez de feedback visual.
- Manter padroes visuais e componentes (cores da marca, nav, toasts) e registrar novos padroes aqui.

## Identidade visual
- Amarelo: #FFD500 | Preto: #0F172A | Cinza claro: #F4F4F5.
- UI com AppNav (oculto em /login; links conforme permissoes), botoes escuros (#0F172A) e destaques amarelos.

## Visao geral
Monorepo fullstack (Next.js App Router + Node/Express + Postgres). Landing publica captura leads; area autenticada traz dashboard, Kanban de leads, gestao de usuarios e visao de cliente. Auth via cookies httpOnly (access/refresh JWT).

## Paginas (web)
- `/` landing (publica): formulario cria/atualiza lead (usa overwrite). Identidade amarela/preta.
- `/login`: login/registro; botao voltar; nav oculto.
- `/aguardando` (protegida, so pending): form completo (nome/email/telefone/cidade/CPF/birthdate/EAR/Uber) envia overwrite, promove a client e redireciona; labels em todos os campos.
- `/cliente` (client): mostra dados do lead e etapa; se stage not_rented/archived, pode "Solicitar novo contato" (reabre para created). Clientes/pending nao veem Home no menu.
- `/dashboard` (perm: view_leads; admin sempre pode ler) KPIs, distribuicao, recentes; filtro de datas semana vigente default aplicado a todos os cards. Inclui metricas de clientes ativos/inativos (atuais e por periodo quando implementado) e cards leads totais/locacoes/conversao/contato.
- `/leads` (perm: view_leads; edicao exige edit_leads): Kanban etapas created/contact/rented/not_rented/archived; drag & drop; modal detalhar com confirmacao de edicao, birthdate date input, selects EAR/Uber; notas com autor; historico com autor/diff; criacao manual inclui CPF/birthdate/EAR/Uber; bloqueio de email/CPF duplicados; coluna Arquivo mostra ultimos 10 + modal listando todos (filtro nome/email/telefone/CPF, abrir lead); busca global inclui CPF; email e somente leitura.
- `/clientes` (perm: view_clients; edicao exige edit_clients): lista clients com busca, filtro por status (todos/ativos/inativos), coluna status e botao ativar/inativar na tabela; modal detalhar/editar perfil completo (email so leitura) com confirmacao; historico de alteracoes com autor/diff; status mostrado no modal.
- `/movimentacoes` (perm: view_cars/edit_cars): tabela com ultima movimentacao de cada carro ativo (placa, modelo, fornecedor, km, status, detentor, categoria, tarifa veiculo/cliente, obs, data). Modal cria movimentacao (status parceiro/finalizado requer cliente e opcional reserva; oficina requer oficina+servico+previsao; guincho/patio/equipe com selects; demais status livres). Historico por carro exibido ao clicar, permite editar observacao e data da movimentacao com log de historico.
- `/usuarios` (perm: view_users; edicao exige edit_users): abas staff/clients/pending, busca; mudar papel; checkboxes para permissoes; deslogar usuario; unico local para editar email (input + salvar, sincroniza em leads/client_profile). Nav link aparece se view_users/edit_users.
- `/financeiro` (perms dedicadas: view_finance/edit_finance/manage_finance_types/void_finance): lista creditos/debitos por cliente, filtro por vencimento/tipo/status (inclui cancelado sem contar nos KPIs), select buscavel de cliente com pesquisa, filtro por semana ou periodo completo, paginacao, total (creditos - debitos), criacao/edicao de lancamentos (modais) com observacoes/historico e cadastro de tipos padrao (modal). Botões/acoes respeitam permissoes especificas.

## Permissoes e papeis
- Papeis ativos: pending, client, admin. Nenhum papel recebe permissoes por default; tudo via user_permissions (view_/edit_ leads/clients/users). Admin pode ler dashboard mesmo sem perm.
- Permissoes granulares em tabela user_permissions (vertical). JWT inclui permissions; /me retorna user com permissions. requirePermission valida token/DB.
- Fluxos de navegacao: pending fora /aguardando -> /aguardando; client fora /cliente -> /cliente; se permissao ausente, rota retorna 403 e UI bloqueia.

## Banco (docker/db/init.sql)
- users: id, email unico, password_hash opcional, role (pending/client/admin), timestamps.
- user_permissions: user_id + perm_key + allowed (vertical, unique).
- leads: name, cpf (unique), birthdate, phone, email, user_id FK users (unique), city, ear, uber, stage, stage_entered_at, timestamps; triggers garantem email igual ao user e CPF alinhado ao client_profile.
- lead_notes, lead_events (historico de stage_change/edit/note com diff/autor).
- client_profiles: user_id unico FK, dados completos + active boolean default true; trigger garante email igual ao user, CPF alinhado ao lead; client_profile_history com autor/diff.
- finance_entry_types: tipos padrao (name, kind opcional, descricao).
- finance_entries: lancamentos por client_id (FK users) + type_id opcional, label, descricao, kind, amount numeric(12,2), emission_date, due_date, status (pendente/pago/atrasado/cancelado), voided boolean, timestamps; status atrasado exibido quando pendente com vencimento passado.
- finance_entry_notes: observacoes por lancamento (mensagem, autor, timestamps).
- finance_entry_history: historico de edicoes por lancamento (diff, autor, timestamps).
- car_options: catalogo generico para carros (categorias, modelos, fornecedores, tarifas, rastreadores, oficinas, guinchos, patios, equipes).
- car_movements: movimentacoes de carros (status, km, data, obs, cliente/reserva, oficina/servico/ETA, guincho, patio/disponibilidade, equipe, autor) apenas consultadas para carros com status ativo/disponivel.
- car_movement_history: historico de diffs das movimentacoes.

## Backend (apps/api)
- Express com CORS/cookies. Auth register/login/refresh/logout; JWT inclui role/email/perms. Login falha se password_hash vazio.
- Rotas publicas: POST /api/lead (landing/aguardando) com overwrite; /health, / ping.
- Protegidas: /api/leads (view/edit_leads; admin le) list/detalhe/update/move/note, valida email/CPF duplicados, archive stale; /api/clients (view/edit_clients) lista/detalha/atualiza perfis, stats ativos/inativos; /api/users (view/edit_users) lista, muda role/perms, atualiza email (sincroniza leads/profile), logout; /api/finance (view_clients/edit_clients) lista/filtra lancamentos por cliente/vencimento/tipo/status, cria/edita/anula (voided) lancamentos, CRUD de tipos padrao, detalhe com notas/historico; /api/my-lead retorna lead do usuario; /api/my-lead/reopen reabre not_rented/archived.
- Repos: leadRepo (user_id, sync email/CPF, updateLeadsCpf/Email), clientRepo (stats ativos/inativos), userRepo (perms verticais, update email/role/perms), financeRepo (tipos, lancamentos, notas e historico, status atrasado calculado).

## Frontend (apps/web)
- Next.js App Router; ToastProvider global; AuthGuard para role/pending/client; AppNav com links por permissao (sem /login).
- Servicos: auth, leads, clients (inclui stats), users (role/perms/email/logout), finance (entries e tipos), api (health/feedback placeholder).
- Padrao de feedback: sempre toasts.

## Tratamento de erros e UI
- Erros/avisos/sucesso/info: usar ToastProvider. Sem alert.
- Modais de confirmacao em edicoes sensiveis.
- E-mail editavel somente via /usuarios.

## Comandos uteis
- Contexto rapido: `Get-Content AI_NOTES.md; Get-Content map.txt`
- Listar arquivos: `rg --files`
- Buscar texto: `rg "termo"`

## Historico recente
- Permissoes verticais, roles simplificados, dashboard libera admin.
- Emails/CPFs sincronizados entre user/lead/client, triggers de consistencia.
- Clientes: status ativo/inativo com botao e KPI; emails so via /usuarios.
- Fix active nullish em validacao.
- Ajuste active not null: migracao `UPDATE client_profiles SET active=true WHERE active IS NULL` e upsert de perfil forca active=true quando nao informado.
- Paginacao: /clientes tabela com paginacao client-side; /usuarios paginacao client-side com controles; email so edita aqui.
- Grafico clientes: dashboard usa Chart.js para clientes ativos/inativos por mes (rotas /api/clients/stats/summary e /stats/monthly); KPIs respeitam range e retornam 0 quando fora.
- Financeiro: tabelas finance_entry_types/finance_entries com voided e status cancelado, notas/historico, rotas /api/finance (entries/types/detalhe/notes), pagina /financeiro com filtros (cliente buscavel, semana/periodo completo, paginacao, total creditos-debitos), modais de lancamentos e tipos, observacoes e historico de edicoes.
- Seed: emails gerados com lpad (sem espacos), ON CONFLICT dos leads sem target p/ indice parcial de user_id, CTE de clientes unifica usuarios novos e existentes e lancamentos financeiros agora sao variados/aleatorios (1-3 por cliente, tipos/valores/status aleatorios), datas aleatorias entre 01/01/2025 e 31/12/2025 para todos os registros, leads distribuidos entre todas as etapas, insere opcoes/carros/historico de carros (car_options, cars, car_history).
- Dashboard: filtro de range dos KPIs de leads usa stage_entered_at (fallback created_at/stage_entered_at) para contabilizar movimentos mais recentes.
- Auth: tokens e payloads de login/refresh agora incluem permissoes financeiras (view/edit/manage_types/void) para evitar 403 em /finance com permissoes gravadas no banco.
- Rota /api/users/:id/permissions aceita tambem permissoes financeiras (view/edit/manage_types/void) para salvar toggles da pagina /usuarios.
- KPI clientes: stats mensais e resumo usam eventos de ativacao/desativacao (diff.active no historico), evitando ativacoes falsas em edicoes de outros campos; eventos ignorados saem dos KPIs; range considera stage_entered_at.
- Permissoes: requirePermission sempre recarrega permissoes atuais do banco para evitar acesso com token desatualizado.
- Financeiro: PATCH /api/finance/entries/:id usa middleware dedicado para validar perm void_finance/edit_finance sem deixar a request pendente.
- Historico de clientes: quem tiver perm void_finance pode ocultar eventos de (des)ativacao via /api/clients/history/:id/ignore; colunas ignored_at/ignored_by em client_profile_history removem eventos das visualizacoes e KPIs.
- UI clientes: modal de historico de ativacoes exibe botao "Ocultar" (perm void_finance) para remover eventos das visualizacoes/KPIs, chamando o endpoint de ignore.
- Carros: permissoes view_cars/edit_cars; API /api/cars (carsRoutes + carService/repo) com CRUD, historico (car_history) e opcoes (car_options); migracoes 20250302_cars/20250303_car_options/20250304_car_tracker_text e tabelas no init. Pagina /carros lista/edita/cadastra carros com selects de opcoes (modais "Novo" para categoria/modelo/fornecedor/tarifa/rastreador), combustivel/cor/cilindrada/versao fixos e anos 2000-2050; imagens enviadas como arquivo, comprimidas no front e salvas em /uploads (apps/api/public/uploads/cars servido estaticamente).
- Movimentacoes: API /api/car-movements (lista ultima por carro ativo, historico por carro, cria, patch obs/data) usando perms de carros; schema car_movements + car_movement_history no init. Pagina /movimentacoes lista ultimas por carro, abre historico por carro e permite editar obs/data; modal "Nova movimentacao" com campos condicionais por status; selects de oficinas/guinchos/patios/equipes via car_options.
- Front refeito: clientes com status (badge + ativar/inativar), filtro e paginação; histórico de ativações no modal; emails só via /usuarios.
- Dashboard: KPIs de clientes ativos/inativos filtrados por data; gráfico vertical Chart.js (ano vigente) usando stats mensais.
- Usuários: paginação; edição de email; permissões e tabs intactas.
- Services: clients com stats/ monthly; pacote chart.js/react-chartjs-2 adicionado.
