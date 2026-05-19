import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const MOVIES = [
  { title: "Duna: Parte Dois", year: 2024, category: "ficcao", poster: "https://image.tmdb.org/t/p/w500/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg", voteCount: 142 },
  { title: "Deadpool & Wolverine", year: 2024, category: "acao", poster: "https://image.tmdb.org/t/p/w500/8cdWjvZQUExUUTzyp4t6EDMubfO.jpg", voteCount: 98 },
  { title: "Alien: Romulus", year: 2024, category: "terror", poster: "https://image.tmdb.org/t/p/w500/b33nnKl1GSFbao4l3fZDDqsMx0F.jpg", voteCount: 76 },
  { title: "Inside Out 2", year: 2024, category: "animacao", poster: "https://image.tmdb.org/t/p/w500/vpnVM9B6NMmQpWeZvzLvDESb2QY.jpg", voteCount: 201 },
  { title: "Coringa: Delírio a Dois", year: 2024, category: "drama", poster: "https://image.tmdb.org/t/p/w500/2Bf0PGKIcVlFxeEQXnZLYZPBsya.jpg", voteCount: 53 },
  { title: "Shrek 5", year: 2026, category: "animacao", poster: "https://image.tmdb.org/t/p/w500/6ELJEzQJ3Y45HczvreradPZqYRQ.jpg", voteCount: 115 },
  { title: "Mad Max: Furiosa", year: 2024, category: "acao", poster: "https://image.tmdb.org/t/p/w500/iADOJ8Zymht2JPMoy3R7xceZprc.jpg", voteCount: 87 },
  { title: "Terrifier 3", year: 2024, category: "terror", poster: "https://image.tmdb.org/t/p/w500/l1175hgL5DoXnqeZQCcU3eKMbOZ.jpg", voteCount: 64 },
  { title: "Sonic 3", year: 2024, category: "comedia", poster: "https://image.tmdb.org/t/p/w500/d8Ryb8AunYAuycVKDp5HpdWPKgC.jpg", voteCount: 130 },
  { title: "Wicked", year: 2024, category: "drama", poster: "https://image.tmdb.org/t/p/w500/c5Tqxeo1UpBvnAc3csUm7j3hlQl.jpg", voteCount: 92 },
  { title: "Missão Impossível 8", year: 2025, category: "acao", poster: "https://image.tmdb.org/t/p/w500/z53D72EAOxGRqdr7KXXWp9dJiDe.jpg", voteCount: 109 },
  { title: "A Substância", year: 2024, category: "terror", poster: "https://image.tmdb.org/t/p/w500/lqoMzCcZYEFK729d6qzt349fB4o.jpg", voteCount: 47 },
];

async function main() {
  console.log("🌱 Seeding database...");

  // Clear existing movies (keep users/votes if any)
  await prisma.vote.deleteMany();
  await prisma.movie.deleteMany();

  for (const movie of MOVIES) {
    await prisma.movie.create({ data: movie });
  }

  console.log(`✅ Seeded ${MOVIES.length} movies.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
