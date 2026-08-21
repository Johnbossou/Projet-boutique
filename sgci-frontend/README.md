# SGCI Frontend

<p align="center">
  <a href="https://nextjs.org" target="_blank"><img src="https://assets.vercel.com/image/upload/v1667499521/front-end-frameworks/nextjs-logo-dark.svg" width="400" alt="Next.js Logo"></a>
</p>

<p align="center">
  Système de Gestion Commerciale Intelligente - Frontend Dashboard
</p>

## About SGCI Frontend

SGCI Frontend is a modern web application built with Next.js 15, React, and TypeScript. It provides a comprehensive dashboard for managing retail businesses with features including:

- Multi-tenant boutique management
- Product inventory management
- Sales and transaction processing
- Customer relationship management
- Analytics and reporting
- Real-time notifications
- Dark mode support
- Responsive design

## Features

### Core Features
- **Multi-Tenancy**: Boutique selection and management for proprietaires
- **Authentication**: JWT-based authentication with the backend API
- **Error Handling**: Error Boundary for graceful error handling
- **Toast Notifications**: Centralized toast notifications with Sonner
- **Skeleton Loaders**: Loading states for better UX
- **Pagination**: Consistent pagination UI across all list views
- **SEO**: Optimized meta tags for search engines
- **Accessibility**: ARIA labels and accessibility guidelines
- **Theme**: Dark mode support with theme persistence

### Pages
- **Dashboard**: Overview with statistics and recent activity
- **Products**: Product management (CRUD operations)
- **Sales**: Sales processing and history
- **Customers**: Customer management
- **Inventory**: Stock management and movements
- **Analytics**: Reports and charts
- **Settings**: User and boutique settings

## Requirements

- Node.js >= 18.x
- npm, yarn, pnpm, or bun
- SGCI Backend API running

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd sgci-frontend
```

2. Install dependencies:
```bash
npm install
# or
yarn install
# or
pnpm install
# or
bun install
```

3. Create environment file:
```bash
cp .env.example .env.local
```

4. Configure environment variables in `.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

5. Run the development server:
```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── (auth)/            # Authentication pages
│   ├── dashboard/         # Dashboard pages
│   ├── layout.tsx         # Root layout
│   └── page.tsx          # Home page
├── components/           # React components
│   ├── ui/               # UI components (shadcn/ui)
│   └── ...              # Custom components
├── contexts/             # React contexts
├── lib/                  # Utility functions
└── styles/              # Global styles
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui
- **Icons**: Lucide React
- **Forms**: React Hook Form + Zod
- **HTTP Client**: Axios
- **Notifications**: Sonner
- **Charts**: Recharts
- **State Management**: React Context API

## Environment Variables

Create a `.env.local` file in the project root with the following variables:

```env
# Backend API Configuration
NEXT_PUBLIC_API_URL=http://localhost:8000/api

# Frontend Application URL
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Google Search Console Verification (optional)
NEXT_PUBLIC_GOOGLE_VERIFICATION=
```

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_URL` | Backend API URL | `http://localhost:8000/api` |
| `NEXT_PUBLIC_APP_URL` | Frontend application URL | `http://localhost:3000` |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_GOOGLE_VERIFICATION` | Google Search Console verification code | - |

## Deployment

### Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme).

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

### Docker

```bash
# Build the Docker image
docker build -t sgci-frontend .

# Run the container
docker run -p 3000:3000 sgci-frontend
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

The SGCI project is proprietary software. All rights reserved.

## Support

For support, please contact the development team.
