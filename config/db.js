const { Sequelize } = require("sequelize");

const isProduction = process.env.NODE_ENV === "production";

const databaseUrl = process.env.DATABASE_URL;

let sequelize;

if (databaseUrl) {
  console.log("🔌 PostgreSQL: Using DATABASE_URL");

  sequelize = new Sequelize(databaseUrl, {
    dialect: "postgres",
    logging: false,

    dialectOptions: isProduction
      ? {
          ssl: {
            require: true,
            rejectUnauthorized: false,
          },
        }
      : {},

    pool: {
      max: 5,
      min: 0,
      acquire: 10000,
      idle: 10000,
    },

    connectTimeout: 10000,

    retry: {
      max: 2,
    },
  });
} else {
  console.log("🔌 PostgreSQL: Using DB_* variables");

 sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASS,
  {
    host: "127.0.0.1",
    port: Number(process.env.DB_PORT) || 5432,
    dialect: "postgres",

    logging: console.log,

    dialectOptions: {},

    pool: {
      max: 5,
      min: 0,
      acquire: 10000,
      idle: 10000,
    },

    connectTimeout: 10000,

    retry: {
      max: 2,
    },
  }

);
}

const connectDB = async () => {
  try {
    console.log("🔌 Connecting to PostgreSQL...");

    await sequelize.authenticate();

    console.log("✅ PostgreSQL Connected");

    return sequelize;
  } catch (error) {
    console.error("❌ PostgreSQL Connection Failed");
    console.error("NAME:", error?.name);
    console.error("MESSAGE:", error?.message);

    throw error;
  }
};

module.exports = {
  sequelize,
  connectDB,
};