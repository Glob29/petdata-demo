-- SQLite-схема демо-базы (Nutrition DB + Breed DB).
-- Production-версия для PostgreSQL: db/schema.postgres.sql.
-- Принципы: провенанс, базисы, версии, SKU в конкретном рынке.

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------------
-- Источники
-- ---------------------------------------------------------------------------

CREATE TABLE source (
    id            INTEGER PRIMARY KEY,
    kind          TEXT NOT NULL,              -- manufacturer / retailer / registry / research / label / manual
    name          TEXT NOT NULL,
    url           TEXT,
    license       TEXT,
    reliability   INTEGER NOT NULL DEFAULT 3, -- 1..5
    notes         TEXT
);

-- ---------------------------------------------------------------------------
-- Nutrition DB
-- ---------------------------------------------------------------------------

CREATE TABLE manufacturer (
    id            INTEGER PRIMARY KEY,
    name          TEXT NOT NULL UNIQUE,
    country       TEXT,
    website       TEXT,
    source_id     INTEGER REFERENCES source(id)
);

CREATE TABLE brand (
    id              INTEGER PRIMARY KEY,
    manufacturer_id INTEGER REFERENCES manufacturer(id),
    name            TEXT NOT NULL,
    website         TEXT,
    source_id       INTEGER REFERENCES source(id)
);

CREATE TABLE product (
    id                INTEGER PRIMARY KEY,
    brand_id          INTEGER NOT NULL REFERENCES brand(id),
    line_name         TEXT,
    name              TEXT NOT NULL,
    name_key          TEXT,
    species           TEXT NOT NULL CHECK (species IN ('dog','cat')),
    life_stage        TEXT CHECK (life_stage IN ('puppy','kitten','adult','senior','all','unknown')),
    size_class        TEXT CHECK (size_class IN ('mini','small','medium','large','giant','all','unknown')),
    form              TEXT CHECK (form IN ('dry','wet','semi_moist','raw','treat','supplement','unknown')),
    completeness      TEXT CHECK (completeness IN ('complete','complementary','mixed','unknown')),
    class             TEXT NOT NULL DEFAULT 'unknown' CHECK (class IN ('economy','premium','super_premium','holistic','unknown')),
    class_source      TEXT,
    class_confidence  REAL,
    food_per_kg_day   REAL,
    reference_weight_kg REAL,
    food_per_kg_basis TEXT,
    food_per_kg_confidence REAL,
    therapeutic       INTEGER NOT NULL DEFAULT 0,
    therapeutic_class TEXT,
    market            TEXT NOT NULL DEFAULT 'RU',
    language          TEXT NOT NULL DEFAULT 'ru',
    source_id         INTEGER REFERENCES source(id),
    source_url        TEXT,
    confidence        REAL CHECK (confidence BETWEEN 0 AND 1),
    updated_at        TEXT
);

CREATE INDEX idx_product_species ON product(species, life_stage);
CREATE INDEX idx_product_brand   ON product(brand_id);
CREATE UNIQUE INDEX uq_product_name_key
    ON product (brand_id, name_key, species, form, market)
    WHERE name_key IS NOT NULL;

CREATE VIRTUAL TABLE product_fts USING fts5(
    product_id UNINDEXED,
    name,
    brand,
    composition,
    tokenize = 'unicode61 remove_diacritics 2'
);

CREATE TABLE package (
    id          INTEGER PRIMARY KEY,
    product_id  INTEGER NOT NULL REFERENCES product(id) ON DELETE CASCADE,
    weight_g    REAL NOT NULL CHECK (weight_g > 0),
    pack_count  INTEGER NOT NULL DEFAULT 1,
    gtin        TEXT,
    price       REAL,
    currency    TEXT,
    region      TEXT,
    retailer    TEXT,
    source_id   INTEGER REFERENCES source(id),
    -- Вес всей упаковки (85 г × 10 = 850 г), средняя цена и цена за грамм.
    -- Считаются db/compute-prices.js из price_snapshot, руками не правятся.
    total_weight_g   REAL,
    price_avg        REAL,
    price_per_g      REAL,
    price_samples    INTEGER NOT NULL DEFAULT 0,
    price_updated_at TEXT
);

CREATE TABLE nutrient (
    id            INTEGER PRIMARY KEY,
    code          TEXT NOT NULL UNIQUE,
    name_ru       TEXT NOT NULL,
    name_en       TEXT,
    unit          TEXT NOT NULL,
    category      TEXT NOT NULL,              -- macro / amino / fatty / vitamin / mineral / energy / other
    default_basis TEXT NOT NULL DEFAULT 'as_fed',
    sort_order    INTEGER NOT NULL DEFAULT 100
);

CREATE TABLE product_nutrient (
    id          INTEGER PRIMARY KEY,
    product_id  INTEGER NOT NULL REFERENCES product(id) ON DELETE CASCADE,
    nutrient_id INTEGER NOT NULL REFERENCES nutrient(id),
    amount      REAL NOT NULL,
    unit        TEXT NOT NULL,
    basis       TEXT NOT NULL CHECK (basis IN ('as_fed','dm','per_1000_kcal')),
    value_type  TEXT NOT NULL CHECK (value_type IN ('min','max','typical','declared','calculated')),
    method      TEXT,
    source_id   INTEGER REFERENCES source(id),
    source_url  TEXT,
    confidence  REAL CHECK (confidence BETWEEN 0 AND 1),
    valid_from  TEXT,
    valid_to    TEXT
);

CREATE INDEX idx_pn_product ON product_nutrient(product_id);
CREATE UNIQUE INDEX uq_pn ON product_nutrient(product_id, nutrient_id, basis, value_type, COALESCE(source_id, 0), COALESCE(valid_from, ''));

CREATE TABLE ingredient (
    id             INTEGER PRIMARY KEY,
    name_ru        TEXT NOT NULL,
    name_en        TEXT,
    parent_id      INTEGER REFERENCES ingredient(id),
    animal_origin  INTEGER,
    allergen_group TEXT
);

CREATE TABLE product_ingredient (
    id            INTEGER PRIMARY KEY,
    product_id    INTEGER NOT NULL REFERENCES product(id) ON DELETE CASCADE,
    ingredient_id INTEGER NOT NULL REFERENCES ingredient(id),
    position      INTEGER,
    percent       REAL CHECK (percent BETWEEN 0 AND 100),
    percent_type  TEXT CHECK (percent_type IN ('as_fed','rehydrated','unknown'))
);

CREATE TABLE additive (
    id        INTEGER PRIMARY KEY,
    e_number  TEXT,
    name_ru   TEXT NOT NULL,
    name_en   TEXT,
    category  TEXT
);

CREATE TABLE product_additive (
    id          INTEGER PRIMARY KEY,
    product_id  INTEGER NOT NULL REFERENCES product(id) ON DELETE CASCADE,
    additive_id INTEGER NOT NULL REFERENCES additive(id),
    amount      REAL,
    unit        TEXT
);

CREATE TABLE claim (
    id         INTEGER PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES product(id) ON DELETE CASCADE,
    claim_type TEXT,
    text       TEXT NOT NULL
);

CREATE TABLE feeding_guide (
    id             INTEGER PRIMARY KEY,
    product_id     INTEGER NOT NULL REFERENCES product(id) ON DELETE CASCADE,
    weight_min_kg  REAL,
    weight_max_kg  REAL,
    grams_per_day  REAL,
    note           TEXT
);

-- Снимки цен: одна цена = одна точка наблюдения.
CREATE TABLE price_snapshot (
    id          INTEGER PRIMARY KEY,
    product_id  INTEGER NOT NULL REFERENCES product(id) ON DELETE CASCADE,
    package_id  INTEGER REFERENCES package(id),
    price       REAL NOT NULL CHECK (price >= 0),
    currency    TEXT NOT NULL DEFAULT 'RUB',
    region      TEXT,
    retailer    TEXT,
    url         TEXT,
    observed_at TEXT NOT NULL
);

CREATE INDEX idx_price_product ON price_snapshot(product_id);

-- Экспертная оценка качества белка и прозрачности состава.
CREATE TABLE product_quality (
    product_id                 INTEGER PRIMARY KEY REFERENCES product(id) ON DELETE CASCADE,
    protein_source             TEXT,
    animal_protein_percent     REAL,
    protein_digestibility_pct  REAL,
    diaas                      REAL,
    protein_quality_score      REAL CHECK (protein_quality_score BETWEEN 0 AND 5),
    notes                      TEXT,
    flags_json                 TEXT
);

-- ---------------------------------------------------------------------------
-- Аллергены и источники белка
-- ---------------------------------------------------------------------------

CREATE TABLE allergen_group (
    code                 TEXT PRIMARY KEY,
    name_ru              TEXT NOT NULL,
    description          TEXT,
    cross_reactivity_note TEXT,
    source_id            INTEGER REFERENCES source(id)
);

CREATE TABLE protein_source (
    id              INTEGER PRIMARY KEY,
    code            TEXT NOT NULL UNIQUE,
    name_ru         TEXT NOT NULL,
    name_en         TEXT,
    group_code      TEXT NOT NULL REFERENCES allergen_group(code),
    animal_origin   INTEGER NOT NULL DEFAULT 1,
    is_novel        INTEGER NOT NULL DEFAULT 0,
    notes           TEXT,
    source_id       INTEGER REFERENCES source(id)
);

CREATE TABLE product_protein_source (
    id                 INTEGER PRIMARY KEY,
    product_id         INTEGER NOT NULL REFERENCES product(id) ON DELETE CASCADE,
    protein_source_id  INTEGER NOT NULL REFERENCES protein_source(id),
    role               TEXT CHECK (role IN ('primary','secondary','trace')),
    declared_percent   REAL CHECK (declared_percent BETWEEN 0 AND 100),
    is_hydrolyzed      INTEGER NOT NULL DEFAULT 0,
    source_id          INTEGER REFERENCES source(id),
    confidence         REAL CHECK (confidence BETWEEN 0 AND 1)
);

CREATE INDEX idx_pps_product ON product_protein_source(product_id);

-- Сертификаты, декларации, ветеринарные документы.
CREATE TABLE certificate (
    id           INTEGER PRIMARY KEY,
    product_id   INTEGER REFERENCES product(id) ON DELETE CASCADE,
    brand_id     INTEGER REFERENCES brand(id),
    scope        TEXT NOT NULL DEFAULT 'brand' CHECK (scope IN ('brand','product','batch')),
    type         TEXT CHECK (type IN ('declaration','vet_certificate','quality','unknown')),
    number       TEXT,
    issuer       TEXT,
    valid_from   TEXT,
    valid_to     TEXT,
    url          TEXT,
    status       TEXT NOT NULL DEFAULT 'found' CHECK (status IN ('found','not_found','expired','unreadable')),
    notes        TEXT,
    source_id    INTEGER REFERENCES source(id),
    observed_at  TEXT NOT NULL
);

CREATE INDEX idx_certificate_product ON certificate(product_id);

-- ---------------------------------------------------------------------------
-- Breed DB
-- ---------------------------------------------------------------------------

CREATE TABLE breed (
    id                   INTEGER PRIMARY KEY,
    species              TEXT NOT NULL CHECK (species IN ('dog','cat')),
    name_ru              TEXT NOT NULL,
    name_en              TEXT,
    fci_group            TEXT,
    origin_country       TEXT,
    size_class           TEXT CHECK (size_class IN ('mini','small','medium','large','giant')),
    height_min_cm        REAL,
    height_max_cm        REAL,
    weight_min_kg        REAL,
    weight_max_kg        REAL,
    lifespan_min_years   REAL,
    lifespan_max_years   REAL,
    coat_type            TEXT,
    coat_length          TEXT CHECK (coat_length IN ('short','medium','long','hairless')),
    grooming_level       TEXT CHECK (grooming_level IN ('low','medium','high')),
    brachycephalic       INTEGER NOT NULL DEFAULT 0,
    exercise_level       TEXT CHECK (exercise_level IN ('low','medium','high')),
    temperament          TEXT,
    extra_json           TEXT,
    source_id            INTEGER REFERENCES source(id),
    UNIQUE (species, name_ru)
);

CREATE INDEX idx_breed_species ON breed(species, size_class);

CREATE TABLE breed_weight (
    id         INTEGER PRIMARY KEY,
    breed_id   INTEGER NOT NULL REFERENCES breed(id) ON DELETE CASCADE,
    sex        TEXT CHECK (sex IN ('male','female','any')),
    age_stage  TEXT CHECK (age_stage IN ('puppy','adult','senior')),
    min_kg     REAL,
    max_kg     REAL,
    source_id  INTEGER REFERENCES source(id)
);

CREATE TABLE condition (
    id          INTEGER PRIMARY KEY,
    code        TEXT NOT NULL UNIQUE,
    name_ru     TEXT NOT NULL,
    name_en     TEXT,
    category    TEXT,
    description TEXT
);

CREATE TABLE breed_predisposition (
    id              INTEGER PRIMARY KEY,
    breed_id        INTEGER NOT NULL REFERENCES breed(id) ON DELETE CASCADE,
    condition_id    INTEGER NOT NULL REFERENCES condition(id),
    prevalence_text TEXT,
    evidence_level  TEXT NOT NULL CHECK (evidence_level IN ('A','B','C','D')),
    age_of_onset    TEXT,
    source_id       INTEGER REFERENCES source(id),
    notes           TEXT,
    UNIQUE (breed_id, condition_id, source_id)
);

CREATE INDEX idx_predisposition_breed ON breed_predisposition(breed_id);

CREATE TABLE genetic_test (
    id             INTEGER PRIMARY KEY,
    breed_id       INTEGER NOT NULL REFERENCES breed(id) ON DELETE CASCADE,
    gene           TEXT,
    mutation       TEXT,
    inheritance    TEXT,
    test_available INTEGER NOT NULL DEFAULT 0,
    source_id      INTEGER REFERENCES source(id)
);

-- ---------------------------------------------------------------------------
-- API-метаданные (заготовка)
-- ---------------------------------------------------------------------------

CREATE TABLE dataset_version (
    id          INTEGER PRIMARY KEY,
    version     TEXT NOT NULL,
    released_at TEXT NOT NULL,
    notes       TEXT
);

CREATE TABLE extraction_run (
    id             INTEGER PRIMARY KEY,
    product_id     INTEGER REFERENCES product(id),
    source_id      INTEGER REFERENCES source(id),
    url            TEXT NOT NULL,
    fetched_at     TEXT NOT NULL DEFAULT (datetime('now')),
    http_status    INTEGER,
    parser         TEXT,
    model          TEXT,
    schema_version TEXT,
    status         TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','parsed','validated','failed','review')),
    confidence     REAL,
    raw_path       TEXT,
    error          TEXT
);

CREATE INDEX idx_extraction_run_url ON extraction_run(url);

CREATE TABLE product_source_page (
    id          INTEGER PRIMARY KEY,
    product_id  INTEGER NOT NULL REFERENCES product(id) ON DELETE CASCADE,
    source_id   INTEGER REFERENCES source(id),
    url         TEXT NOT NULL,
    fetched_at  TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'parsed' CHECK (status IN ('parsed','validated','failed')),
    UNIQUE (product_id, url)
);

CREATE INDEX idx_product_source_page ON product_source_page(product_id);

CREATE TABLE review_queue (
    id          INTEGER PRIMARY KEY,
    product_id  INTEGER REFERENCES product(id) ON DELETE CASCADE,
    reason      TEXT NOT NULL,
    payload     TEXT,
    status      TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved','rejected')),
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    resolved_at TEXT
);
