# Garmin Dashboard

Painel para analisar **seus próprios dados** do Garmin Connect, rodando **só no seu computador**:

- **Corrida:** evolução de ritmo e eficiência, melhores marcas, VDOT estimado, zonas de frequência cardíaca e volume semanal.
- **Km a km:** na lista de Atividades, cada corrida abre ritmo, FC, cadência e subida por quilômetro.
- **Saúde diária e Sono:** passos, FC em repouso, estresse, Body Battery, fases do sono e VFC noturna.
- **Tendências:** como essas métricas evoluem em 7, 30 ou 90 dias, ou 1 ano.

Cada tela traz **observações automáticas** sobre os seus números, comparando com o seu próprio histórico. A aba Corrida também cruza sono, VFC e Body Battery com o desempenho nas corridas.

Ele usa a **Garmin Connect Personal API** com uma chave pessoal sua. Nada é enviado para servidores de terceiros: o painel conversa direto com a Garmin a partir do seu computador.

---

## Instalação (uma vez só)

### 1. Instale o Node.js

Baixe e instale a versão **LTS** em <https://nodejs.org> (precisa ser a 22.12 ou mais nova).

No Windows, também dá para instalar pelo terminal:

```
winget install OpenJS.NodeJS.LTS
```

Para conferir, abra um terminal novo e rode `node --version`. Deve aparecer `v22.12.0` ou um número maior.

### 2. Baixe o projeto

- **Com Git:** `git clone https://github.com/FlavioMMarques/Garmin-Dashboard.git`
- **Sem Git:** na página do projeto no GitHub, clique em **Code → Download ZIP** e descompacte numa pasta.

### 3. Instale as dependências

Abra um terminal **dentro da pasta do projeto** e rode:

```
npm install
```

Leva um ou dois minutos na primeira vez. Se aparecer um aviso sobre `install-scripts` do **esbuild**, pode ignorar: o painel funciona sem ele.

## Uso

```
npm start
```

O painel abre sozinho no navegador em **<http://127.0.0.1:8787>**. Para fechar, volte ao terminal e aperte `Ctrl + C`.

### Primeira vez: conectar sua conta Garmin

Na primeira execução o painel abre na tela **Configuração**:

1. Clique em **gerar a chave da Personal API**. O link abre o Garmin Connect em <https://connect.garmin.com/app/settings/personalApiToken>.
2. Escolha a validade (30, 90, 180 ou 365 dias) e **copie a chave na hora**: ela aparece uma única vez.
3. Cole a chave no painel e clique em **Salvar chave**. Ela é testada com a Garmin antes de ser gravada.

Pronto: a aba **Corrida** mostra seus treinos.

### Quando a chave expirar

O painel avisa que a chave foi recusada. Gere uma nova no Garmin Connect e cole em **Configuração**. Não precisa reiniciar nada.

## Privacidade

- **Onde fica a chave:** só no arquivo `.env` da pasta do projeto, no seu computador. Ela é usada apenas pelo servidor local para falar com a Garmin e **nunca é enviada para o navegador**.
- **Quem acessa o painel:** só o seu computador. O servidor escuta em `127.0.0.1`, então outros aparelhos da rede não conseguem abrir o painel. Ele também recusa pedidos vindos de outros sites.
- **O que fica gravado:** nenhum dado de treino é salvo em disco. Os dados são buscados na Garmin quando você abre o painel e ficam em memória por alguns minutos.
- **Km a km:** ao abrir o detalhe de uma corrida, o servidor local baixa da Garmin o arquivo original da atividade (`.FIT`, que inclui o trajeto GPS) e calcula os quilômetros ali mesmo, em memória. Só o resultado (ritmo, FC, cadência e subida por km) vai para a tela; **as coordenadas GPS nunca chegam ao navegador** e o arquivo não é salvo.
- **Se for compartilhar a pasta:** nunca envie o `.env` para outra pessoa nem para o GitHub. Ele já está no `.gitignore`.

## Problemas comuns

| Sintoma                                             | O que fazer                                                                                                                                                   |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `node` ou `npm` "não é reconhecido"                 | Feche e abra o terminal depois de instalar o Node.js. Se continuar, reinstale o Node marcando a opção de adicionar ao PATH.                                   |
| "A porta 8787 já está em uso"                       | O painel provavelmente já está aberto em outro terminal. Feche-o, ou escolha outra porta colocando `PORT=8790` no `.env`.                                     |
| "A Garmin recusou essa chave"                       | Confira se copiou a chave inteira e se ela não expirou. Se não tiver certeza, gere uma nova.                                                                  |
| Os gráficos só mostram dados a partir de certa data | O painel mostra o histórico que a Garmin disponibiliza pela Personal API para a sua conta. Escolha **Tudo** no seletor de período para ver tudo o que existe. |
| "Limite de requisições da Garmin"                   | Espere alguns minutos e tente de novo.                                                                                                                        |
| Conta Garmin da China                               | Coloque `GARMIN_BASE_URL=https://personal.connectapi.garmin.cn` no `.env`.                                                                                    |
| Página em branco ou "o app ainda não foi compilado" | Rode `npm start`, que compila antes de iniciar. Se persistir, rode `npm run build` e veja se aparece algum erro.                                              |

---

## Para desenvolvedores

| Comando             | O que faz                                                                   |
| ------------------- | --------------------------------------------------------------------------- |
| `npm run dev`       | Servidor com recarga automática (:8787) + Vite (:5173, com proxy de `/api`) |
| `npm start`         | Compila o web e serve tudo em http://127.0.0.1:8787                         |
| `npm run build`     | Compila o web para `web/dist`                                               |
| `npm test`          | Testes (Vitest) dos dois workspaces                                         |
| `npm run typecheck` | `tsc --noEmit` nos dois workspaces                                          |
| `npm run lint`      | ESLint                                                                      |

**Estrutura (npm workspaces):**

- **`server/`:** Hono no Node. Troca a chave por token, faz as chamadas à Garmin, devolve só os campos que o painel usa e, em produção, serve o web compilado.
- **`web/`:** Vite + React + TanStack Query + Recharts. As agregações e as regras de insights são funções puras em `web/src/lib/`, todas com teste.

**Documentos:**

- [SPEC.md](SPEC.md): objetivos, endpoints usados e limites.
- [tasks/plan.md](tasks/plan.md): plano de implementação.
- [docs/decisions/](docs/decisions/): decisões de arquitetura.
- [docs/garmin-openapi.json](docs/garmin-openapi.json): spec OpenAPI da Personal API, extraída da documentação oficial.

O arquivo `.FIT` é lido com [fit-file-parser](https://github.com/jimmykane/fit-parser) (licença MIT). O SDK oficial da Garmin foi descartado porque usá-lo exige aceitar um contrato de licença com a Garmin.

As análises de treino (VDOT, ritmos sugeridos, previsões) usam as fórmulas de Jack Daniels e J. Gilbert. As observações de saúde e sono são comparações com o seu próprio histórico e com referências comuns. Tudo isso é **estimativa** e não substitui a orientação de um treinador ou médico.
