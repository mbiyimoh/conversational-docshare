# Conversational Document Share - Development Setup

## Quick Start

### Prerequisites
- Node.js 20+
- PostgreSQL 14+
- Docker & Docker Compose (for deployment)

### Installation

1. **Install dependencies**
```bash
npm run install:all
```

2. **Set up environment variables**
```bash
# Backend
cp backend/.env.example backend/.env
# Edit backend/.env with your database credentials and API keys

# Frontend
cp frontend/.env.example frontend/.env
```

3. **Set up database**
```bash
cd backend
npx prisma migrate dev
npx prisma generate
```

4. **Start development servers**
```bash
# From root directory
npm run dev

# Or individually:
npm run dev:backend  # Backend on port 4000
npm run dev:frontend # Frontend on port 5173
```

### Project Structure

```
conversational-docshare/
├── backend/               # Express.js API server
│   ├── src/
│   │   ├── routes/       # API route handlers
│   │   ├── controllers/  # Business logic
│   │   ├── services/     # Core services
│   │   ├── middleware/   # Express middleware
│   │   ├── utils/        # Helper functions
│   │   └── types/        # TypeScript types
│   ├── prisma/           # Database schema & migrations
│   └── uploads/          # File upload storage
├── frontend/             # React + Vite application
│   └── src/
│       ├── components/   # UI components
│       ├── pages/        # Route pages
│       ├── hooks/        # Custom React hooks
│       ├── lib/          # Utilities & API client
│       └── styles/       # CSS/Tailwind styles
└── shared/              # Shared TypeScript types
    └── types/

```

### Available Scripts

**Root:**
- `npm run dev` - Start both frontend and backend in dev mode
- `npm run build` - Build both frontend and backend for production
- `npm run lint` - Lint all packages
- `npm run format` - Format code with Prettier
- `npm run docker:up` - Start Docker containers
- `npm run docker:down` - Stop Docker containers

**Backend:**
- `npm run dev` - Start dev server with hot reload
- `npm run build` - Build for production
- `npm run prisma:generate` - Generate Prisma client
- `npm run prisma:migrate` - Run database migrations
- `npm run prisma:studio` - Open Prisma Studio GUI

**Frontend:**
- `npm run dev` - Start Vite dev server
- `npm run build` - Build for production
- `npm run preview` - Preview production build

### Environment Variables

See `.env.example` files in `backend/` and `frontend/` directories for required configuration.

Key variables:
- `DATABASE_URL` - PostgreSQL connection string
- `OPENAI_API_KEY` - OpenAI API key for LLM
- `NEXTAUTH_SECRET` - Secret for session encryption
- `JWT_SECRET` - Secret for JWT tokens

### Database Management

```bash
# Create a new migration
cd backend
npx prisma migrate dev --name migration_name

# Reset database (WARNING: destroys all data)
npx prisma migrate reset

# Open Prisma Studio (database GUI)
npx prisma studio
```

### Docker Deployment

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Development Workflow

1. Create a feature branch
2. Make changes
3. Run linting: `npm run lint`
4. Run formatting: `npm run format`
5. Test locally with `npm run dev`
6. Commit and push
7. Create pull request

### Troubleshooting

**Port already in use:**
- Backend: Change `PORT` in `backend/.env`
- Frontend: Change port in `frontend/vite.config.ts`

**Database connection errors:**
- Verify PostgreSQL is running
- Check `DATABASE_URL` in `backend/.env`
- Run `npx prisma migrate dev` to sync schema

**Module not found errors:**
- Run `npm run install:all` to reinstall dependencies
- Clear node_modules and reinstall: `rm -rf node_modules package-lock.json && npm install`

## Documentation

See the `/specs` directory for detailed documentation:
- `conversational-document-ide-spec.md` - Complete technical specification
- `conversational-document-ide-tasks.md` - Task breakdown
- `01-document-processing-algorithms.md` - Document processing details
- `02-llm-integration-architecture.md` - LLM & RAG architecture
- `03-api-reference.md` - API endpoint specifications
- `04-authentication-authorization.md` - Auth implementation
- `05-error-handling-specifications.md` - Error handling patterns

Also see:
- `README.md` - Project overview
- `QUICK-START-GUIDE.md` - How to use the documentation
- `ARCHITECTURE-INTEGRATION.md` - Architecture overview
