import { PrismaClient, Category } from "@prisma/client";

const prisma = new PrismaClient();

const movies = [
  {
    title:       "Interestelar",
    year:        2014,
    category:    Category.ficcao,
    poster:      "https://image.tmdb.org/t/p/w500/xJHokMbljvjADYdit5fK5VQsXEG.jpg",
    description: "Uma equipe de astronautas viaja pelo universo em busca de um novo lar para a humanidade.",
    voteCount:   0,
  },
  {
    title:       "Coringa",
    year:        2019,
    category:    Category.drama,
    poster:      "https://image.tmdb.org/t/p/w500/udDclJoHjfjb8Ekgsd4FDteOkCU.jpg",
    description: "A origin story de Arthur Fleck, um homem ignorado pela sociedade que se torna o Coringa.",
    voteCount:   0,
  },
  {
    title:       "Hereditário",
    year:        2018,
    category:    Category.terror,
    poster:      "https://image.tmdb.org/t/p/w500/p0MpDzomFMcYkMXqnXUl4EIAZ5.jpg",
    description: "Após a morte da matriarca, uma família começa a desenterrar segredos perturbadores.",
    voteCount:   0,
  },
  {
    title:       "The Gentlemen",
    year:        2019,
    category:    Category.acao,
    poster:      "https://image.tmdb.org/t/p/w500/jtrhTYB7xSrJxR1vusu99nvnZ1g.jpg",
    description: "Um traficante americano tenta vender seu império de cannabis na Inglaterra.",
    voteCount:   0,
  },
  {
    title:       "Superbad",
    year:        2007,
    category:    Category.comedia,
    poster:      "https://image.tmdb.org/t/p/w500/ek8e8txUyUwd2BNqj6lFEerJfbq.jpg",
    description: "Dois amigos inseparáveis tentam sobreviver ao ensino médio e a festas épicas.",
    voteCount:   0,
  },
  {
    title:       "Homem-Aranha: No Aranhaverso",
    year:        2018,
    category:    Category.animacao,
    poster:      "https://image.tmdb.org/t/p/w500/iiZZdoQBEYBv6id8su7ImL0oCbD.jpg",
    description: "Miles Morales se torna o Homem-Aranha e viaja pelo multiverso.",
    voteCount:   0,
  },
];

async function main() {
  console.log("🌱 Seeding...");
  for (const m of movies) {
    await prisma.movie.upsert({
      where:  { id: m.title }, // não existe, sempre cria
      update: {},
      create: m,
    });
  }
  console.log(`✅ ${movies.length} filmes inseridos.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
