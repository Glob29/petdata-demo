-- Демо-данные: 7 SKU и 6 пород.
-- Все значения — из открытых карточек/исследований; где данных нет, они отсутствуют намеренно.

-- ---------------------------------------------------------------------------
-- Источники
-- ---------------------------------------------------------------------------

INSERT INTO source (id, kind, name, url, license, reliability, notes) VALUES
(1, 'manufacturer', 'Grandorf, карточка продукта', 'https://grandorf.ru/fresh/catalog/cat_foods/wet_food/gdf_konservy_d_k_kurinaya_grudka_v_zhele_70_g/', 'ToS сайта', 5, 'Официальная карточка'),
(2, 'retailer', 'Hill''s Science Plan Adult Cat Chicken, карточка/тест', 'https://rskrf.ru/goods/hill-s-science-plan-dlya-vzroslykh-koshek-s-kuritsey/', 'Copyright', 3, 'Значения требуют проверки по упаковке'),
(3, 'retailer', 'Royal Canin Protein Exigent, карточка', 'https://magizoo.ru/catalog/royal_canin_dlya_vzroslykh_koshek/1334469/', 'ToS сайта', 3, 'Часть данных отсутствует'),
(4, 'retailer', 'Purina Pro Plan Sterilised Turkey, карточка', 'https://4lapy.ru/product/sterilised-korm-dlya-sterilizovannyh-koshek-s-indejkoj-1-9-kg-86249-1018213/', 'ToS сайта', 3, 'Часть данных отсутствует'),
(5, 'retailer', 'Farmina N&D Chicken & Pomegranate Puppy, карточка', 'https://farminafood.ru/farmina-nizkozernovaia-kuritca-granat-dlia-shchenkov-srednikh-i-krupnykh-porod-12kg/', 'ToS сайта', 3, 'Часть данных отсутствует'),
(6, 'registry', 'FCI breed standards', 'https://www.fci.be/en/Nomenclature/', 'Copyright FCI', 5, 'Стандарты пород'),
(7, 'research', 'VetCompass Open Access data', 'https://rvc-web-app01.live01.azure.rvc.ac.uk/vetcompass/papers-and-data/open-access-data', 'Research use', 5, 'Распространённость болезней'),
(8, 'research', 'OMIA', 'https://www.omia.org/', 'CC BY', 5, 'Генетические ассоциации'),
(9, 'research', 'Agria Breed Profiles', 'https://www.agria.se/fakta-och-rad/hund/agria-dog-breed-profiles/', 'Публикация', 4, 'Ветеринарные профили пород'),
(10, 'research', 'FEDIAF Nutritional Guidelines 2025', 'https://europeanpetfood.org/wp-content/uploads/2025/09/FEDIAF-Nutritional-Guidelines_2025.pdf', 'Copyright FEDIAF', 5, 'Нормативы'),
(11, 'research', 'AAHA Nutrition and Weight Management Guidelines', 'https://www.aaha.org/resources/2021-aaha-nutrition-and-weight-management-guidelines/', 'Copyright AAHA', 5, 'Практические алгоритмы');

INSERT INTO source (id, kind, name, url, license, reliability, notes) VALUES
(12, 'manufacturer', 'Royal Canin KZ, Indoor 27', 'https://royalcaninkz.kz/produktsiya/produktsiya-dlya-koshek/indoor-27/', 'ToS сайта', 5, 'ME 3815 ккал/кг'),
(13, 'manufacturer', 'Grandorf EU, Sterilised Turkey', 'https://grandorf.eu/catalog/cat_foods/sterilised_cats/gd_sterilised_turkey_400_n/', 'ToS сайта', 5, 'Белок 37%, жир 11%, ME 4060'),
(14, 'retailer', 'Purina Pro Plan Sterilised, карточка', 'https://www.allvet.ru/food/for_cats/purina-pro-plan-sterilised-s-indeykoy/', 'ToS сайта', 3, 'Белок 41%, жир 12%, омега-3/6');

INSERT INTO source (id, kind, name, url, license, reliability, notes) VALUES
(15, 'research', 'Olivry, Mueller, Prelaud. Common food allergen sources in dogs and cats', 'https://pmc.ncbi.nlm.nih.gov/articles/PMC4710035/', 'CC BY', 5, 'CAT 2: beef, dairy, chicken, wheat, lamb; cats: beef, fish, chicken'),
(16, 'research', 'Poultry allergen cross-reactivity and hydrolyzation', 'https://europepmc.org/article/pmc/5561598', 'CC BY', 5, 'Chicken/duck/turkey IgE cross-reactivity'),
(17, 'research', 'ELISA detection of soy and beef protein in dry dog foods', 'https://onlinelibrary.wiley.com/doi/full/10.1111/j.1439-0396.2010.01016.x', 'Copyright', 4, 'Перекрёстная контаминация в коммерческих кормах');

-- ---------------------------------------------------------------------------
-- Производители и бренды
-- ---------------------------------------------------------------------------

INSERT INTO manufacturer (id, name, country, website, source_id) VALUES
(1, 'Absolute Petfood', 'Таиланд', 'https://grandorf.ru/', 1),
(2, 'Hill''s Pet Nutrition', 'США', 'https://www.hillspet.ru/', 2),
(3, 'Royal Canin (Mars)', 'Франция', 'https://royalcanin.ru/', 3),
(4, 'Nestlé Purina', 'США', 'https://www.purina.ru/', 4),
(5, 'Farmina Pet Foods', 'Италия', 'https://www.farmina.com/ru/', 5);

INSERT INTO brand (id, manufacturer_id, name, website, source_id) VALUES
(1, 1, 'Grandorf', 'https://grandorf.ru/', 1),
(2, 2, 'Hill''s', 'https://www.hillspet.ru/', 2),
(3, 3, 'Royal Canin', 'https://royalcanin.ru/', 3),
(4, 4, 'Purina Pro Plan', 'https://www.purina.ru/', 4),
(5, 5, 'Farmina', 'https://www.farmina.com/ru/', 5);

-- ---------------------------------------------------------------------------
-- Продукты
-- ---------------------------------------------------------------------------

INSERT INTO product (id, brand_id, line_name, name, species, life_stage, size_class, form, completeness, therapeutic, market, language, source_id, source_url, confidence, updated_at) VALUES
(1, 1, 'Grandorf Fresh', 'Куриная грудка в желе', 'cat', 'adult', 'all', 'wet', 'complementary', 0, 'RU', 'ru', 1, 'https://grandorf.ru/fresh/catalog/cat_foods/wet_food/gdf_konservy_d_k_kurinaya_grudka_v_zhele_70_g/', 0.95, '2026-11-21'),
(2, 2, 'Science Plan', 'Adult Cat Chicken', 'cat', 'adult', 'all', 'dry', 'complete', 0, 'RU', 'ru', 2, 'https://rskrf.ru/goods/hill-s-science-plan-dlya-vzroslykh-koshek-s-kuritsey/', 0.65, '2026-11-21'),
(3, 3, 'Protein Exigent', 'Protein Exigent', 'cat', 'adult', 'all', 'dry', 'complete', 0, 'RU', 'ru', 3, 'https://magizoo.ru/catalog/royal_canin_dlya_vzroslykh_koshek/1334469/', 0.65, '2026-11-21'),
(4, 4, 'Pro Plan Sterilised', 'Sterilised Turkey', 'cat', 'adult', 'all', 'dry', 'complete', 0, 'RU', 'ru', 4, 'https://4lapy.ru/product/sterilised-korm-dlya-sterilizovannyh-koshek-s-indejkoj-1-9-kg-86249-1018213/', 0.65, '2026-11-21'),
(5, 5, 'N&D', 'Chicken & Pomegranate Puppy', 'dog', 'puppy', 'medium', 'dry', 'complete', 0, 'RU', 'ru', 5, 'https://farminafood.ru/farmina-nizkozernovaia-kuritca-granat-dlia-shchenkov-srednikh-i-krupnykh-porod-12kg/', 0.65, '2026-11-21');

-- Три SKU для сравнения цены и качества белка (близкая категория: взрослые кошки, сухой корм).
INSERT INTO product (id, brand_id, line_name, name, species, life_stage, size_class, form, completeness, therapeutic, market, language, source_id, source_url, confidence, updated_at) VALUES
(6, 3, 'Indoor', 'Indoor 27', 'cat', 'adult', 'all', 'dry', 'complete', 0, 'RU', 'ru', 12, 'https://pro.royalcanin.co.uk/products/cat/indoor-27/', 0.8, '2026-11-21'),
(7, 1, 'Sterilised', 'Turkey Sterilised', 'cat', 'adult', 'all', 'dry', 'complete', 0, 'RU', 'ru', 13, 'https://grandorf.eu/catalog/cat_foods/sterilised_cats/gd_sterilised_turkey_400_n/', 0.9, '2026-11-21');

INSERT INTO package (id, product_id, weight_g, pack_count, price, currency, region, retailer, source_id) VALUES
(1, 1, 70, 1, NULL, 'RUB', 'RU', NULL, 1),
(2, 2, 1500, 1, NULL, 'RUB', 'RU', NULL, 2),
(3, 3, 2000, 1, NULL, 'RUB', 'RU', NULL, 3),
(4, 4, 1500, 1, NULL, 'RUB', 'RU', NULL, 4),
(5, 5, 12000, 1, NULL, 'RUB', 'RU', NULL, 5);

INSERT INTO package (id, product_id, weight_g, pack_count, price, currency, region, retailer, source_id) VALUES
(6, 6, 2000, 1, NULL, 'RUB', 'RU', NULL, 12),
(7, 7, 2000, 1, NULL, 'RUB', 'RU', NULL, 13);

-- ---------------------------------------------------------------------------
-- Словарь нутриентов
-- ---------------------------------------------------------------------------

INSERT INTO nutrient (id, code, name_ru, name_en, unit, category, sort_order) VALUES
(1, 'protein', 'Белок', 'Protein', '%', 'macro', 10),
(2, 'fat', 'Жир', 'Fat', '%', 'macro', 20),
(3, 'fiber', 'Клетчатка', 'Fiber', '%', 'macro', 30),
(4, 'ash', 'Зола', 'Ash', '%', 'macro', 40),
(5, 'moisture', 'Влага', 'Moisture', '%', 'macro', 50),
(6, 'carbs_nfe', 'Углеводы (NFE)', 'Carbs (NFE)', '%', 'macro', 60),
(7, 'me', 'Метаболическая энергия', 'Metabolizable energy', 'ккал/кг', 'energy', 70),
(8, 'taurine', 'Таурин', 'Taurine', 'мг/кг', 'amino', 80),
(9, 'arginine', 'Аргинин', 'Arginine', '%', 'amino', 81),
(10, 'lysine', 'Лизин', 'Lysine', '%', 'amino', 82),
(11, 'methionine', 'Метионин', 'Methionine', '%', 'amino', 83),
(12, 'cystine', 'Цистин', 'Cystine', '%', 'amino', 84),
(13, 'tryptophan', 'Триптофан', 'Tryptophan', '%', 'amino', 85),
(14, 'threonine', 'Треонин', 'Threonine', '%', 'amino', 86),
(15, 'valine', 'Валин', 'Valine', '%', 'amino', 87),
(16, 'isoleucine', 'Изолейцин', 'Isoleucine', '%', 'amino', 88),
(17, 'leucine', 'Лейцин', 'Leucine', '%', 'amino', 89),
(18, 'phenylalanine', 'Фенилаланин', 'Phenylalanine', '%', 'amino', 90),
(19, 'histidine', 'Гистидин', 'Histidine', '%', 'amino', 91),
(20, 'omega3', 'Омега-3', 'Omega-3', '%', 'fatty', 100),
(21, 'omega6', 'Омега-6', 'Omega-6', '%', 'fatty', 101),
(22, 'epa', 'EPA', 'EPA', '%', 'fatty', 102),
(23, 'dha', 'DHA', 'DHA', '%', 'fatty', 103),
(24, 'arachidonic', 'Арахидоновая кислота', 'Arachidonic acid', '%', 'fatty', 104),
(25, 'vitamin_a', 'Витамин A', 'Vitamin A', 'МЕ/кг', 'vitamin', 110),
(26, 'vitamin_d3', 'Витамин D3', 'Vitamin D3', 'МЕ/кг', 'vitamin', 111),
(27, 'vitamin_e', 'Витамин E', 'Vitamin E', 'мг/кг', 'vitamin', 112),
(28, 'vitamin_k', 'Витамин K', 'Vitamin K', 'мг/кг', 'vitamin', 113),
(29, 'vitamin_c', 'Витамин C', 'Vitamin C', 'мг/кг', 'vitamin', 114),
(30, 'vitamin_b1', 'B1 (тиамин)', 'Thiamine', 'мг/кг', 'vitamin', 115),
(31, 'vitamin_b2', 'B2 (рибофлавин)', 'Riboflavin', 'мг/кг', 'vitamin', 116),
(32, 'vitamin_b3', 'B3 (ниацин)', 'Niacin', 'мг/кг', 'vitamin', 117),
(33, 'vitamin_b5', 'B5 (пантотеновая)', 'Pantothenic acid', 'мг/кг', 'vitamin', 118),
(34, 'vitamin_b6', 'B6 (пиридоксин)', 'Pyridoxine', 'мг/кг', 'vitamin', 119),
(35, 'vitamin_b7', 'B7 (биотин)', 'Biotin', 'мг/кг', 'vitamin', 120),
(36, 'vitamin_b9', 'B9 (фолиевая)', 'Folic acid', 'мг/кг', 'vitamin', 121),
(37, 'vitamin_b12', 'B12 (кобаламин)', 'Cobalamin', 'мг/кг', 'vitamin', 122),
(38, 'choline', 'Холин', 'Choline', 'мг/кг', 'vitamin', 123),
(39, 'calcium', 'Кальций', 'Calcium', '%', 'mineral', 130),
(40, 'phosphorus', 'Фосфор', 'Phosphorus', '%', 'mineral', 131),
(41, 'ca_p_ratio', 'Ca:P', 'Ca:P ratio', 'ratio', 'mineral', 132),
(42, 'magnesium', 'Магний', 'Magnesium', '%', 'mineral', 133),
(43, 'sodium', 'Натрий', 'Sodium', '%', 'mineral', 134),
(44, 'potassium', 'Калий', 'Potassium', '%', 'mineral', 135),
(45, 'chlorine', 'Хлор', 'Chlorine', '%', 'mineral', 136),
(46, 'iron', 'Железо', 'Iron', 'мг/кг', 'mineral', 137),
(47, 'zinc', 'Цинк', 'Zinc', 'мг/кг', 'mineral', 138),
(48, 'copper', 'Медь', 'Copper', 'мг/кг', 'mineral', 139),
(49, 'manganese', 'Марганец', 'Manganese', 'мг/кг', 'mineral', 140),
(50, 'selenium', 'Селен', 'Selenium', 'мг/кг', 'mineral', 141),
(51, 'iodine', 'Йод', 'Iodine', 'мг/кг', 'mineral', 142),
(52, 'cobalt', 'Кобальт', 'Cobalt', 'мг/кг', 'mineral', 143),
(53, 'l_carnitine', 'L-карнитин', 'L-carnitine', 'мг/кг', 'other', 150),
(54, 'glucosamine', 'Глюкозамин', 'Glucosamine', 'мг/кг', 'other', 151),
(55, 'chondroitin', 'Хондроитин', 'Chondroitin', 'мг/кг', 'other', 152),
(56, 'beta_carotene', 'Бета-каротин', 'Beta-carotene', 'мг/кг', 'other', 153),
(57, 'linoleic', 'Линолевая кислота', 'Linoleic acid', '%', 'fatty', 105),
(58, 'alpha_linolenic', 'Альфа-линоленовая кислота', 'Alpha-linolenic acid', '%', 'fatty', 106);

-- ---------------------------------------------------------------------------
-- Нутриенты продуктов
-- ---------------------------------------------------------------------------

INSERT INTO product_nutrient (product_id, nutrient_id, amount, unit, basis, value_type, method, source_id, confidence, valid_from) VALUES
(1, 1, 12.78, '%', 'as_fed', 'declared', 'label', 1, 0.95, '2026-11-21'),
(1, 2, 0.88, '%', 'as_fed', 'declared', 'label', 1, 0.95, '2026-11-21'),
(1, 3, 0.06, '%', 'as_fed', 'declared', 'label', 1, 0.95, '2026-11-21'),
(1, 4, 0.77, '%', 'as_fed', 'declared', 'label', 1, 0.95, '2026-11-21'),
(1, 5, 85.51, '%', 'as_fed', 'declared', 'label', 1, 0.95, '2026-11-21'),
(1, 6, 0.00, '%', 'as_fed', 'calculated', 'difference', 1, 0.8, '2026-11-21'),
(1, 7, 550, 'ккал/кг', 'as_fed', 'declared', 'label', 1, 0.95, '2026-11-21'),
(2, 1, 32.3, '%', 'as_fed', 'typical', 'retailer_label', 2, 0.6, '2026-11-21'),
(2, 2, 20.5, '%', 'as_fed', 'typical', 'retailer_label', 2, 0.6, '2026-11-21'),
(2, 8, 2000, 'мг/кг', 'as_fed', 'typical', 'retailer_label', 2, 0.6, '2026-11-21'),
(2, 25, 6208, 'МЕ/кг', 'as_fed', 'typical', 'retailer_label', 2, 0.6, '2026-11-21'),
(2, 26, 587, 'МЕ/кг', 'as_fed', 'typical', 'retailer_label', 2, 0.6, '2026-11-21'),
(2, 27, 600, 'мг/кг', 'as_fed', 'typical', 'retailer_label', 2, 0.6, '2026-11-21'),
(2, 29, 100, 'мг/кг', 'as_fed', 'typical', 'retailer_label', 2, 0.6, '2026-11-21'),
(2, 56, 1.5, 'мг/кг', 'as_fed', 'typical', 'retailer_label', 2, 0.6, '2026-11-21'),
(3, 1, 42, '%', 'as_fed', 'typical', 'retailer_label', 3, 0.6, '2026-11-21'),
(3, 2, 15, '%', 'as_fed', 'typical', 'retailer_label', 3, 0.6, '2026-11-21'),
(3, 3, 3, '%', 'as_fed', 'typical', 'retailer_label', 3, 0.6, '2026-11-21'),
(4, 1, 41, '%', 'as_fed', 'typical', 'retailer_label', 4, 0.6, '2026-11-21'),
(4, 2, 12, '%', 'as_fed', 'typical', 'retailer_label', 4, 0.6, '2026-11-21'),
(4, 3, 4, '%', 'as_fed', 'typical', 'retailer_label', 4, 0.6, '2026-11-21'),
(4, 4, 7.5, '%', 'as_fed', 'typical', 'retailer_label', 4, 0.6, '2026-11-21'),
(4, 20, 0.5, '%', 'as_fed', 'typical', 'retailer_label', 4, 0.6, '2026-11-21'),
(4, 21, 2.4, '%', 'as_fed', 'typical', 'retailer_label', 4, 0.6, '2026-11-21'),
(5, 1, 35, '%', 'as_fed', 'typical', 'retailer_label', 5, 0.6, '2026-11-21'),
(5, 2, 20, '%', 'as_fed', 'typical', 'retailer_label', 5, 0.6, '2026-11-21');

-- Сравнительная тройка: RC Indoor 27, Grandorf Sterilised, Purina Pro Plan Sterilised.
INSERT INTO product_nutrient (product_id, nutrient_id, amount, unit, basis, value_type, method, source_id, confidence, valid_from) VALUES
(6, 1, 27, '%', 'as_fed', 'declared', 'label', 12, 0.85, '2026-11-21'),
(6, 2, 13, '%', 'as_fed', 'declared', 'label', 12, 0.85, '2026-11-21'),
(6, 3, 4, '%', 'as_fed', 'declared', 'label', 12, 0.85, '2026-11-21'),
(6, 4, 7.3, '%', 'as_fed', 'declared', 'label', 12, 0.85, '2026-11-21'),
(6, 7, 3815, 'ккал/кг', 'as_fed', 'declared', 'measured', 12, 0.85, '2026-11-21'),
(7, 1, 37, '%', 'as_fed', 'declared', 'label', 13, 0.9, '2026-11-21'),
(7, 2, 11, '%', 'as_fed', 'declared', 'label', 13, 0.9, '2026-11-21'),
(7, 3, 2.5, '%', 'as_fed', 'declared', 'label', 13, 0.9, '2026-11-21'),
(7, 4, 8, '%', 'as_fed', 'declared', 'label', 13, 0.9, '2026-11-21'),
(7, 7, 4060, 'ккал/кг', 'as_fed', 'declared', 'label', 13, 0.9, '2026-11-21'),
(7, 21, 2.4, '%', 'as_fed', 'declared', 'label', 13, 0.9, '2026-11-21');

-- ---------------------------------------------------------------------------
-- Ингредиенты
-- ---------------------------------------------------------------------------

INSERT INTO ingredient (id, name_ru, name_en, animal_origin, allergen_group) VALUES
(1, 'Куриная грудка', 'Chicken breast', 1, 'chicken'),
(2, 'Индейка', 'Turkey', 1, 'turkey'),
(3, 'Рис', 'Rice', 0, 'grain'),
(4, 'Кукурузный глютен', 'Corn gluten', 0, 'grain'),
(5, 'Пшеница', 'Wheat', 0, 'grain'),
(6, 'Дегидрированная курица', 'Dehydrated chicken', 1, 'chicken'),
(7, 'Гранат', 'Pomegranate', 0, NULL),
(8, 'Свежая курица', 'Fresh chicken', 1, 'chicken'),
(9, 'Изолят растительных белков', 'Vegetable protein isolate', 0, NULL),
(10, 'Белок птицы', 'Poultry protein', 1, 'poultry'),
(11, 'Свежая индейка', 'Fresh turkey', 1, 'turkey'),
(12, 'Дегидрированная индейка', 'Dehydrated turkey', 1, 'turkey');

INSERT INTO product_ingredient (product_id, ingredient_id, position, percent, percent_type) VALUES
(1, 1, 1, 60, 'as_fed'),
(2, 2, 1, 20, 'as_fed'),
(2, 3, 2, NULL, 'unknown'),
(2, 4, 3, NULL, 'unknown'),
(3, 9, 1, NULL, 'unknown'),
(4, 2, 1, 20, 'as_fed'),
(4, 3, 2, NULL, 'unknown'),
(4, 4, 3, NULL, 'unknown'),
(5, 8, 1, 20, 'as_fed'),
(5, 6, 2, 20, 'as_fed'),
(5, 7, 3, NULL, 'unknown'),
(6, 10, 1, NULL, 'unknown'),
(6, 5, 2, NULL, 'unknown'),
(6, 4, 3, NULL, 'unknown'),
(7, 12, 1, 32, 'as_fed'),
(7, 11, 2, 29, 'as_fed'),
(7, 3, 3, NULL, 'unknown');

INSERT INTO claim (product_id, claim_type, text) VALUES
(1, 'meat', '60% мяса в составе'),
(1, 'grain_free', 'Без зерна и глютена'),
(1, 'complementary', 'Дополнение к сухим кормам'),
(2, 'complete', 'Полнорационный корм'),
(2, 'life_stage', 'Для взрослых кошек'),
(3, 'palatability', 'Для привередливых кошек'),
(4, 'sterilised', 'Для стерилизованных кошек'),
(5, 'grain_free', 'Без зерна'),
(5, 'life_stage', 'Для щенков средних и крупных пород');

INSERT INTO feeding_guide (product_id, weight_min_kg, weight_max_kg, grams_per_day, note) VALUES
(1, 3, 4, 40, 'Ориентир, зависит от активности'),
(1, 4, 5, 50, 'Ориентир, зависит от активности');

-- ---------------------------------------------------------------------------
-- Породы
-- ---------------------------------------------------------------------------

INSERT INTO breed (id, species, name_ru, name_en, fci_group, origin_country, size_class, height_min_cm, height_max_cm, weight_min_kg, weight_max_kg, lifespan_min_years, lifespan_max_years, coat_type, coat_length, grooming_level, brachycephalic, exercise_level, temperament, source_id) VALUES
(1, 'dog', 'Лабрадор-ретривер', 'Labrador Retriever', 'VIII', 'Великобритания', 'large', 54, 57, 25, 36, 10, 12, 'Короткая, плотная, водоотталкивающая', 'short', 'medium', 0, 'high', 'Дружелюбный, активный, ориентирован на человека', 6),
(2, 'dog', 'Немецкая овчарка', 'German Shepherd', 'I', 'Германия', 'large', 55, 65, 22, 40, 9, 13, 'Двойная, средняя', 'medium', 'medium', 0, 'high', 'Уверенный, рабочий, бдительный', 6),
(3, 'dog', 'Французский бульдог', 'French Bulldog', 'IX', 'Франция', 'small', 27, 35, 8, 14, 10, 12, 'Короткая, гладкая', 'short', 'low', 1, 'low', 'Компанейский, упрямый, малоподвижный', 6),
(4, 'cat', 'Мейн-кун', 'Maine Coon', 'III', 'США', 'large', 25, 30, 5.5, 8, 12, 15, 'Полудлинная, густая', 'long', 'high', 0, 'medium', 'Дружелюбный, крупный, социальный', 6),
(5, 'cat', 'Персидская', 'Persian', 'III', 'Иран', 'medium', 25, 30, 3, 5, 12, 17, 'Длинная, густая', 'long', 'high', 1, 'low', 'Спокойный, домашний', 6),
(6, 'cat', 'Британская короткошёрстная', 'British Shorthair', 'III', 'Великобритания', 'medium', 30, 35, 3.5, 8, 12, 17, 'Короткая, плотная', 'short', 'medium', 0, 'low', 'Спокойный, независимый', 6);

INSERT INTO breed_weight (breed_id, sex, age_stage, min_kg, max_kg, source_id) VALUES
(1, 'male', 'adult', 29, 36, 6),
(1, 'female', 'adult', 25, 32, 6),
(2, 'male', 'adult', 30, 40, 6),
(2, 'female', 'adult', 22, 32, 6),
(3, 'male', 'adult', 9, 14, 6),
(3, 'female', 'adult', 8, 13, 6),
(4, 'male', 'adult', 6.8, 8, 6),
(4, 'female', 'adult', 5.5, 6.8, 6),
(5, 'any', 'adult', 3, 5, 6),
(6, 'male', 'adult', 4.5, 8, 6),
(6, 'female', 'adult', 3.5, 5.5, 6);

-- ---------------------------------------------------------------------------
-- Заболевания и предрасположенности
-- ---------------------------------------------------------------------------

INSERT INTO condition (id, code, name_ru, name_en, category) VALUES
(1, 'hip_dysplasia', 'Дисплазия тазобедренного сустава', 'Hip dysplasia', 'orthopedic'),
(2, 'elbow_dysplasia', 'Дисплазия локтевого сустава', 'Elbow dysplasia', 'orthopedic'),
(3, 'obesity', 'Ожирение', 'Obesity', 'metabolic'),
(4, 'otitis_externa', 'Наружный отит', 'Otitis externa', 'skin/ear'),
(5, 'boas', 'Брахицефальный обструктивный синдром', 'BOAS', 'respiratory'),
(6, 'skin_fold_dermatitis', 'Дерматит кожных складок', 'Skin fold dermatitis', 'skin'),
(7, 'ivdd', 'Грыжа межпозвоночного диска', 'IVDD', 'neurologic'),
(8, 'hcm', 'Гипертрофическая кардиомиопатия', 'HCM', 'cardiac'),
(9, 'pkd', 'Поликистоз почек', 'PKD', 'renal'),
(10, 'degenerative_myelopathy', 'Дегенеративная миелопатия', 'Degenerative myelopathy', 'neurologic'),
(11, 'gdv', 'Заворот желудка', 'Gastric dilatation-volvulus', 'gastro'),
(12, 'dystocia', 'Патологические роды', 'Dystocia', 'reproductive'),
(13, 'sma', 'Спинальная мышечная атрофия', 'Spinal muscular atrophy', 'neuromuscular');

INSERT INTO breed_predisposition (breed_id, condition_id, prevalence_text, evidence_level, age_of_onset, source_id, notes) VALUES
(1, 1, 'Повышенный риск', 'B', 'Взрослые', 7, 'Полигенная предрасположенность'),
(1, 2, 'Повышенный риск', 'B', 'Молодые', 7, NULL),
(1, 3, 'Высокая распространённость', 'B', 'Взрослые', 7, 'Склонность к набору веса'),
(1, 4, 'Повышенный риск', 'C', 'Любой', 9, NULL),
(2, 1, 'Повышенный риск', 'B', 'Взрослые', 7, NULL),
(2, 2, 'Повышенный риск', 'B', 'Молодые', 7, NULL),
(2, 10, 'Риск при наличии аллеля SOD1', 'A', 'Старше 8 лет', 8, 'Аутосомно-рецессивный'),
(2, 11, 'Повышенный риск', 'B', 'Взрослые', 7, NULL),
(3, 5, 'Высокая распространённость', 'A', 'С раннего возраста', 7, 'Брахицефалия'),
(3, 6, 'Повышенный риск', 'B', 'Любой', 7, NULL),
(3, 7, 'Повышенный риск', 'B', 'Взрослые', 9, NULL),
(3, 12, 'Повышенный риск', 'B', 'Роды', 9, 'Из-за анатомии'),
(4, 8, 'Риск при мутации MYBPC3', 'A', 'Взрослые', 8, 'Аутосомно-доминантный'),
(4, 1, 'Повышенный риск', 'B', 'Взрослые', 7, NULL),
(4, 13, 'Риск при мутации LIX1', 'B', 'Молодые', 8, 'Аутосомно-рецессивный'),
(5, 9, 'Риск при мутации PKD1', 'A', 'Взрослые', 8, 'Аутосомно-доминантный'),
(5, 5, 'Повышенный риск', 'B', 'С раннего возраста', 7, 'Брахицефалия'),
(5, 8, 'Повышенный риск', 'B', 'Взрослые', 9, NULL),
(6, 8, 'Повышенный риск', 'B', 'Взрослые', 9, NULL),
(6, 9, 'Риск при мутации PKD1', 'B', 'Взрослые', 8, NULL),
(6, 3, 'Повышенный риск', 'B', 'Взрослые', 7, NULL);

INSERT INTO genetic_test (breed_id, gene, mutation, inheritance, test_available, source_id) VALUES
(2, 'SOD1', 'c.118G>A', 'Аутосомно-рецессивный', 1, 8),
(4, 'MYBPC3', 'A31P', 'Аутосомно-доминантный', 1, 8),
(4, 'LIX1', 'c.1423_1424del', 'Аутосомно-рецессивный', 1, 8),
(5, 'PKD1', 'c.10063C>A', 'Аутосомно-доминантный', 1, 8),
(6, 'PKD1', 'c.10063C>A', 'Аутосомно-доминантный', 1, 8);

-- ---------------------------------------------------------------------------
-- Цены и качество белка (снимок 21.11.2026)
-- ---------------------------------------------------------------------------

INSERT INTO price_snapshot (product_id, package_id, price, currency, region, retailer, url, observed_at) VALUES
(6, 6, 2911, 'RUB', 'RU', 'MagiZoo', 'https://magizoo.ru/catalog/royal_canin_dlya_vzroslykh_koshek/1337025/', '2026-11-21'),
(6, 6, 3744, 'RUB', 'RU', 'MagiZoo', 'https://magizoo.ru/catalog/royal_canin_dlya_vzroslykh_koshek/1337025/', '2026-11-21'),
(7, 7, 3381, 'RUB', 'RU', 'Zoki-Zoo', 'https://www.zoki-zoo.ru/internetmagazin/product/grandorf-grandorf-d-k-sterilajz-indejka-ris-2kg', '2026-11-21'),
(7, 7, 4095, 'RUB', 'RU', 'Keks Store', 'https://www.keks-store.ru/katalog/vse-brendy/vitapol/product/korm-grandorf-sterilised-dlya-sterilizovannykh-koshek-indejka-i-ris-2-kg', '2026-11-21'),
(4, 4, 2238, 'RUB', 'RU', 'Papazoo', 'https://papazoo.ru/product/korm_purina_pro_plan_sterilised_indeyka/', '2026-11-21');

INSERT INTO product_quality (product_id, protein_source, animal_protein_percent, protein_quality_score, notes, flags_json) VALUES
(6, 'Dehydrated poultry proteins, wheat gluten, maize', NULL, 2.5, 'Растительные белки в составе; низкий белок 27%; доля животного белка не указана', '["plant_protein","low_protein","opaque_animal_share"]'),
(7, 'Dehydrated turkey 32%, fresh turkey 29%, hydrolysed turkey 5%', 66, 4.5, 'Прозрачные источники, высокий белок 37%, без растительного изолята', '["named_animal_protein","high_animal_share","no_plant_isolate"]'),
(4, 'Turkey 20%, poultry protein, rice, corn gluten', 20, 3.5, '20% индейки, растительные белки, высокий белок 41%', '["named_meat_20","plant_protein","high_protein"]');

-- ---------------------------------------------------------------------------
-- Аллергены: группы, источники белка, привязка продуктов
-- ---------------------------------------------------------------------------

INSERT INTO allergen_group (code, name_ru, description, cross_reactivity_note, source_id) VALUES
('poultry', 'Птица', 'Курица, индейка, утка, перепёл', 'Высокая перекрёстная реактивность: курица/утка/индейка (97–100% IgE в одном исследовании)', 16),
('mammalian', 'Мясо млекопитающих', 'Говядина, баранина, свинина, оленина', 'Возможна перекрёстная реактивность говядина/баранина/молоко; оленина не всегда «новый» белок', 15),
('dairy', 'Молочные продукты', 'Молоко, сыворотка, казеин', 'Перекрёстная реактивность с говядиной', 15),
('fish', 'Рыба', 'Лосось, треска, белая рыба, сельдь', 'Парвальбумин — перекрёстная реактивность между видами рыбы', 15),
('egg', 'Яйцо', 'Куриное яйцо', 'Возможна реакция на белок и желток', 15),
('wheat', 'Пшеница и глютен', 'Пшеница, ячмень, рожь', 'Не все злаки одинаковы; «беззерновой» ≠ гипоаллергенный', 15),
('soy', 'Соя', 'Соевый белок, изолят', 'Частый аллерген; возможна контаминация', 15),
('corn', 'Кукуруза', 'Кукуруза, кукурузный глютен', 'Реже, но встречается', 15),
('rice', 'Рис', 'Рис, рисовый белок', 'Обычно хорошо переносится, но не гарантия', NULL),
('legumes', 'Бобовые', 'Горох, чечевица, нут', 'Риск при чувствительности к растительным белкам', NULL),
('plant_other', 'Растительный белок (не уточнён)', 'Изолят растительного белка', 'Источник не указан — нельзя исключить сою/горох', NULL);

INSERT INTO protein_source (id, code, name_ru, name_en, group_code, animal_origin, is_novel, notes, source_id) VALUES
(1, 'chicken', 'Курица', 'Chicken', 'poultry', 1, 0, 'Частый аллерген №1 у собак и кошек', 15),
(2, 'turkey', 'Индейка', 'Turkey', 'poultry', 1, 0, 'Перекрёстная реактивность с курицей', 16),
(3, 'duck', 'Утка', 'Duck', 'poultry', 1, 0, 'Перекрёстная реактивность с курицей', 16),
(4, 'beef', 'Говядина', 'Beef', 'mammalian', 1, 0, 'Частый аллерген', 15),
(5, 'lamb', 'Баранина', 'Lamb', 'mammalian', 1, 0, 'Перекрёстная реактивность с говядиной/молоком', 15),
(6, 'pork', 'Свинина', 'Pork', 'mammalian', 1, 0, 'Реже, но возможна', NULL),
(7, 'venison', 'Оленина', 'Venison', 'mammalian', 1, 0, 'Не всегда «новый» белок из-за перекрёстной реактивности', 15),
(8, 'salmon', 'Лосось', 'Salmon', 'fish', 1, 0, 'Парвальбумин', 15),
(9, 'whitefish', 'Белая рыба', 'Whitefish', 'fish', 1, 0, 'Парвальбумин', 15),
(10, 'dairy', 'Молочные продукты', 'Dairy', 'dairy', 1, 0, 'Казеин/сыворотка', 15),
(11, 'egg', 'Яйцо', 'Egg', 'egg', 1, 0, 'Куриное яйцо', 15),
(12, 'wheat', 'Пшеница', 'Wheat', 'wheat', 0, 0, 'Глютен/пшеничный белок', 15),
(13, 'soy', 'Соя', 'Soy', 'soy', 0, 0, 'Соевый белок/изолят', 15),
(14, 'corn', 'Кукуруза', 'Corn', 'corn', 0, 0, 'Кукурузный глютен', NULL),
(15, 'rice', 'Рис', 'Rice', 'rice', 0, 0, 'Рисовый белок', NULL),
(16, 'legumes', 'Бобовые', 'Legumes', 'legumes', 0, 0, 'Горох/чечевица', NULL),
(17, 'plant_unspecified', 'Растительный белок (не уточнён)', 'Plant protein, unspecified', 'plant_other', 0, 0, 'Нельзя исключить сою/горох', NULL),
(18, 'poultry_unspecified', 'Птица (вид не указан)', 'Poultry, unspecified', 'poultry', 1, 0, 'В составе «белок птицы» без вида', 16),
(19, 'turkey_hydrolyzed', 'Индейка гидролизованная', 'Hydrolyzed turkey', 'poultry', 1, 0, 'Гидролизат; степень гидролиза не указана', 16),
(20, 'rabbit', 'Кролик', 'Rabbit', 'mammalian', 1, 0, 'Реже, но встречается', NULL);

INSERT INTO product_protein_source (product_id, protein_source_id, role, declared_percent, is_hydrolyzed, source_id, confidence) VALUES
(1, 1, 'primary', 60, 0, 1, 0.95),
(2, 1, 'primary', NULL, 0, 2, 0.6),
(2, 2, 'secondary', NULL, 0, 2, 0.5),
(3, 17, 'primary', NULL, 0, 3, 0.6),
(4, 2, 'primary', 20, 0, 4, 0.8),
(4, 18, 'secondary', NULL, 0, 4, 0.7),
(5, 1, 'primary', 40, 0, 5, 0.7),
(6, 18, 'primary', NULL, 0, 12, 0.8),
(6, 12, 'secondary', NULL, 0, 12, 0.6),
(6, 14, 'secondary', NULL, 0, 12, 0.5),
(7, 2, 'primary', 61, 0, 13, 0.9),
(7, 19, 'secondary', 5, 1, 13, 0.9);

INSERT INTO dataset_version (version, released_at, notes) VALUES
('2026.11-demo', '2026-11-21', 'Демо: 7 SKU, 6 пород, 3 SKU с ценами и качеством белка');
