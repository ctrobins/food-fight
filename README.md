# Food Fight!

App to vote over what local restaurant to eat at with your friends or coworkers. Allows users to nominate where to eat and others can either vote to approve or veto it and suggest somewhere else to eat.

## Local development

**Requirements:** Node 18+, Docker (for PostgreSQL)

```bash
cp .env.example .env   # if you don't already have .env
docker compose up -d
npm install
npm run build          # or use `npm run dev` for watch mode + nodemon
npm start
```

Open [http://localhost:3001](http://localhost:3001) (default port is 3001 so it doesn't clash with other apps on 3000).

`npm run dev` runs webpack in watch mode and the API with nodemon together.

### Optional services

Copy API keys into `.env` when you need these features:

- **Yelp** (`YELP_API_KEY`) — restaurant search on the home page
- **Google OAuth** — sign in with Google
- **Mailjet** — invite emails
- **Gmail** (`GMAIL_ADDRESS`, `GMAIL_PASSWORD`) — welcome emails on signup

Without them, the app still runs; those flows are skipped or return a friendly message.

## Deployment

Necessary ENV variables:

```
GOOGLE_AUTH_CLIENT_ID=
GOOGLE_AUTH_CLIENT_SECRET=
GMAIL_ADDRESS=
GMAIL_PASSWORD=
YELP_API_KEY=
MAILJET_API_KEY=
MAILJET_API_SECRET=
DB_HOST=
DB_NAME=
DB_USER=
DB_PORT=
DB_PASSWORD=
DB_SSL=true
DOMAIN=
SESSION_SECRET=
PORT=
```

## Built With

- [React](https://react.dev/)
- [Postgres](https://www.postgresql.org/)
- [Bulma](https://bulma.io/)
- [Passport](http://www.passportjs.org/)
- [Node](https://nodejs.org/en/)

## Authors

- [**Carter Robinson**](https://github.com/ctrobins)
- [**Mitchell Stewart**](https://github.com/mitchstewart08)
- [**Raphael Croce**](https://github.com/riffryder)
- [**Travis James Smith**](https://github.com/Trajamsmith)
