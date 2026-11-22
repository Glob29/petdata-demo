-- СГЕНЕРИРОВАНО db/gen-breeds-sql.js из db/breeds-data.json — не редактировать вручную.
-- Повторный запуск генератора перезаписывает файл.
-- Вставки идемпотентные: работают и на чистой базе, и как миграция.
PRAGMA foreign_keys = ON;

-- Новые источники данных
INSERT OR IGNORE INTO source (id, kind, name, url, license, reliability, notes) VALUES
(18, 'encyclopedia', 'Wikipedia RU: карточки пород (инфобокс, параметры стандартов FCI)', 'https://ru.wikipedia.org/wiki/Порода_кошек', 'CC BY-SA 4.0', 3, 'Сводные параметры (рост, вес, продолжительность жизни). Для собак совпадают с номером стандарта FCI; часть полей без указания первичного источника.'),
(19, 'estimate', 'PetData: экспертная оценка (не верифицирована)', NULL, NULL, 2, 'Заполнено вручную там, где открытого структурированного источника нет. Требует сверки с первичным стандартом или исследованием до коммерческого использования.');

-- Новые заболевания
INSERT OR IGNORE INTO condition (id, code, name_ru, name_en, category) VALUES
(14, 'patellar_luxation', 'Вывих коленной чашечки', 'Patellar luxation', 'orthopedic'),
(15, 'tracheal_collapse', 'Коллапс трахеи', 'Tracheal collapse', 'respiratory'),
(16, 'ckd', 'Хроническая болезнь почек', 'Chronic kidney disease', 'renal'),
(17, 'flutd', 'Болезни нижних мочевых путей', 'FLUTD', 'urinary'),
(18, 'atopic_dermatitis', 'Атопический дерматит', 'Atopic dermatitis', 'skin'),
(19, 'hypothyroidism', 'Гипотиреоз', 'Hypothyroidism', 'endocrine'),
(20, 'epilepsy', 'Идиопатическая эпилепсия', 'Idiopathic epilepsy', 'neurologic'),
(21, 'pra', 'Прогрессирующая атрофия сетчатки', 'Progressive retinal atrophy', 'ophthalmic'),
(22, 'cataracts', 'Катаракта', 'Cataracts', 'ophthalmic'),
(23, 'entropion', 'Заворот века', 'Entropion', 'ophthalmic'),
(24, 'ccl_rupture', 'Разрыв передней крестообразной связки', 'Cranial cruciate ligament rupture', 'orthopedic'),
(25, 'vwd', 'Болезнь Виллебранда', 'von Willebrand disease', 'hematologic'),
(26, 'dcm', 'Дилатационная кардиомиопатия', 'Dilated cardiomyopathy', 'cardiac'),
(27, 'arvc', 'Аритмогенная кардиомиопатия правого желудочка', 'Arrhythmogenic right ventricular cardiomyopathy', 'cardiac'),
(28, 'portosystemic_shunt', 'Портокавальный шунт', 'Portosystemic shunt', 'hepatic'),
(29, 'hydrocephalus', 'Гидроцефалия', 'Hydrocephalus', 'neurologic'),
(30, 'hemivertebra', 'Гемивертебра', 'Hemivertebra', 'neurologic'),
(31, 'osteochondrodysplasia', 'Остеохондродисплазия', 'Osteochondrodysplasia', 'skeletal'),
(32, 'dental_disease', 'Заболевания зубов и пародонта', 'Periodontal disease', 'dental'),
(33, 'lens_luxation', 'Вывих хрусталика', 'Lens luxation', 'ophthalmic'),
(34, 'feline_asthma', 'Бронхиальная астма кошек', 'Feline asthma', 'respiratory');

-- Породы
INSERT INTO breed (id, species, name_ru, name_en, fci_group, origin_country, size_class, height_min_cm, height_max_cm, weight_min_kg, weight_max_kg, lifespan_min_years, lifespan_max_years, coat_type, coat_length, grooming_level, brachycephalic, exercise_level, temperament, extra_json, source_id) VALUES
(7, 'dog', 'Йоркширский терьер', 'Yorkshire Terrier', 'III', 'Великобритания', 'mini', 18, 20, 1.8, 3.2, 13, 16, 'Длинная, шелковистая, без подшёрстка', 'long', 'high', 0, 'low', 'Активный, смелый, сильно привязан к хозяину', '{"fci_number":86,"data_quality":"mixed","wiki":"https://ru.wikipedia.org/?curid=278834"}', 18),
(8, 'dog', 'Чихуахуа', 'Chihuahua', 'IX', 'Мексика', 'mini', 15, 23, 1, 3, 14, 16, 'Короткая или длинная, с подшёрстком', 'short', 'low', 0, 'low', 'Смелый, энергичный, ревнивый к хозяину', '{"fci_number":218,"data_quality":"estimate","wiki":"https://ru.wikipedia.org/?curid=1122277"}', 18),
(9, 'dog', 'Такса', 'Dachshund', 'IV', 'Германия', 'small', NULL, NULL, 7, 9, 12, 16, 'Гладкая, длинная или жёсткая', 'short', 'low', 0, 'medium', 'Смелый, любопытный, упрямый', '{"fci_number":148,"data_quality":"fci","wiki":"https://ru.wikipedia.org/?curid=244834"}', 18),
(10, 'dog', 'Ши-тцу', 'Shih Tzu', 'IX', 'Тибет', 'mini', NULL, 27, 4.5, 8, 10, 16, 'Длинная, густая, с подшёрстком', 'long', 'high', 0, 'low', 'Ласковый, уверенный, независимый', '{"fci_number":208,"data_quality":"fci","wiki":"https://ru.wikipedia.org/?curid=965986"}', 18),
(11, 'dog', 'Мопс', 'Pug', 'IX', 'Китай', 'small', 28, 32, 6.3, 8.1, 12, 15, 'Короткая, гладкая', 'short', 'low', 1, 'low', 'Общительный, упрямый, ориентирован на человека', '{"fci_number":253,"data_quality":"mixed","wiki":"https://ru.wikipedia.org/?curid=313854"}', 18),
(12, 'dog', 'Померанский шпиц', 'Pomeranian', 'V', 'Германия', 'mini', 18, 22, 1.8, 3.5, 12, 16, 'Длинная, густая, с плотным подшёрстком', 'long', 'high', 0, 'low', 'Живой, любопытный, громкий', '{"fci_number":97,"data_quality":"estimate","wiki":"https://ru.wikipedia.org/?curid=2762726"}', 18),
(13, 'dog', 'Мальтийская болонка', 'Maltese', 'IX', 'Мальта', 'mini', 20, 25, 3, 4, 12, 15, 'Длинная, шелковистая, без подшёрстка', 'long', 'high', 0, 'low', 'Ласковый, игривый, доверчивый', '{"fci_number":65,"data_quality":"fci","wiki":"https://ru.wikipedia.org/?curid=1235634"}', 18),
(14, 'dog', 'Золотистый ретривер', 'Golden Retriever', 'VIII', 'Великобритания', 'large', 51, 61, 25, 34, 10, 12, 'Средней длины, плотная, водоотталкивающая, с подшёрстком', 'medium', 'medium', 0, 'high', 'Дружелюбный, обучаемый, ориентирован на человека', '{"fci_number":111,"data_quality":"estimate","wiki":"https://ru.wikipedia.org/?curid=626193"}', 18),
(15, 'dog', 'Английский кокер-спаниель', 'English Cocker Spaniel', 'VIII', 'Великобритания', 'medium', 38, 43, 13, 15, 11, 14, 'Средней длины, волнистая, с подшёрстком', 'medium', 'high', 0, 'high', 'Энергичный, общительный, азартный', '{"fci_number":5,"data_quality":"mixed","wiki":"https://ru.wikipedia.org/?curid=1362845"}', 18),
(16, 'dog', 'Бигль', 'Beagle', 'VI', 'Великобритания', 'medium', 33, 40, 9, 14, 12, 15, 'Короткая, плотная, водостойкая', 'short', 'low', 0, 'high', 'Дружелюбный, любознательный, ведомый запахом', '{"fci_number":161,"data_quality":"fci","wiki":"https://ru.wikipedia.org/?curid=193007"}', 18),
(17, 'dog', 'Сибирский хаски', 'Siberian Husky', 'V', 'США', 'medium', 50.5, 60, 15.5, 28, 12, 14, 'Двойная, средней длины, густой подшёрсток', 'medium', 'high', 0, 'high', 'Энергичный, независимый, дружелюбный', '{"fci_number":270,"data_quality":"fci","wiki":"https://ru.wikipedia.org/?curid=631707"}', 18),
(18, 'dog', 'Ротвейлер', 'Rottweiler', 'II', 'Германия', 'large', 56, 68, 35, 50, 9, 12, 'Короткая, прямая, с подшёрстком', 'short', 'low', 0, 'medium', 'Уверенный, спокойный, защитный', '{"fci_number":147,"data_quality":"fci","wiki":"https://ru.wikipedia.org/?curid=54625"}', 18),
(19, 'dog', 'Боксёр', 'Boxer', 'II', 'Германия', 'large', 53, 63, 25, 32, 10, 12, 'Короткая, гладкая, плотная', 'short', 'low', 1, 'high', 'Энергичный, игривый, уверенный', '{"fci_number":144,"data_quality":"mixed","wiki":"https://ru.wikipedia.org/?curid=518630"}', 18),
(20, 'dog', 'Бордер-колли', 'Border Collie', 'I', 'Великобритания', 'medium', 48, 56, 15, 20, 12, 15, 'Длинная или средней длины, с подшёрстком', 'medium', 'medium', 0, 'high', 'Интенсивный, обучаемый, ориентирован на работу', '{"fci_number":297,"data_quality":"estimate","wiki":"https://ru.wikipedia.org/?curid=176718"}', 18),
(21, 'dog', 'Доберман', 'Dobermann', 'II', 'Германия', 'large', 63, 72, 32, 45, 10, 12, 'Короткая, гладкая, плотно прилегающая', 'short', 'low', 0, 'high', 'Смелый, бдительный, работоспособный', '{"fci_number":143,"data_quality":"fci","wiki":"https://ru.wikipedia.org/?curid=456073"}', 18),
(22, 'dog', 'Джек-рассел-терьер', 'Jack Russell Terrier', 'III', 'Великобритания', 'small', 25, 30, 5, 6, 13, 16, 'Гладкая, жёсткая или с изломом', 'short', 'low', 0, 'high', 'Азартный, смелый, неутомимый', '{"fci_number":345,"data_quality":"fci","wiki":"https://ru.wikipedia.org/?curid=676777"}', 18),
(23, 'cat', 'Бенгальская кошка', 'Bengal', 'III', 'США', 'medium', NULL, NULL, 3.5, 7, 12, 16, 'Короткая, плотная, с «диким» рисунком', 'short', 'low', 0, 'high', 'Активный, любопытный, игривый', '{"fci_number":null,"data_quality":"estimate","wiki":"https://ru.wikipedia.org/?curid=652204"}', 19),
(24, 'cat', 'Канадский сфинкс', 'Sphynx', 'III', 'Канада', 'medium', NULL, NULL, 3.5, 5.5, 12, 14, 'Бесшёрстная, кожный покров с пушком', 'hairless', 'medium', 0, 'medium', 'Ласковый, общительный, активный', '{"fci_number":null,"data_quality":"estimate","wiki":"https://ru.wikipedia.org/?curid=512572"}', 19),
(25, 'cat', 'Шотландская вислоухая', 'Scottish Fold', 'III', 'Великобритания', 'medium', NULL, NULL, 2.7, 6, 12, 15, 'Короткая, плотная', 'short', 'medium', 0, 'medium', 'Спокойный, ласковый, ненавязчивый', '{"fci_number":null,"data_quality":"fci","wiki":"https://ru.wikipedia.org/?curid=795301"}', 18),
(26, 'cat', 'Абиссинская кошка', 'Abyssinian', 'III', 'Эфиопия', 'medium', NULL, NULL, 3, 6, 12, 16, 'Короткая, тикированная', 'short', 'low', 0, 'high', 'Активный, любопытный, контактный', '{"fci_number":null,"data_quality":"fci","wiki":"https://ru.wikipedia.org/?curid=550753"}', 18),
(27, 'cat', 'Сибирская кошка', 'Siberian', 'III', 'Россия', 'large', NULL, NULL, 3.5, 9, 12, 15, 'Полудлинная, густая, с двойным подшёрстком', 'long', 'high', 0, 'medium', 'Спокойный, уверенный, привязанный к дому', '{"fci_number":null,"data_quality":"fci","wiki":"https://ru.wikipedia.org/?curid=1306109"}', 18),
(28, 'cat', 'Русская голубая кошка', 'Russian Blue', 'III', 'Россия', 'medium', NULL, NULL, 3, 5, 15, 20, 'Короткая, плотная, двойная', 'short', 'low', 0, 'medium', 'Сдержанный, деликатный, привязанный к хозяину', '{"fci_number":null,"data_quality":"estimate","wiki":"https://ru.wikipedia.org/?curid=415005"}', 19),
(29, 'cat', 'Сиамская кошка', 'Siamese', 'IV', 'Таиланд', 'medium', NULL, NULL, 3, 5, 15, 20, 'Короткая, плотно прилегающая, без подшёрстка', 'short', 'low', 0, 'high', 'Общительный, разговорчивый, требовательный к вниманию', '{"fci_number":null,"data_quality":"estimate","wiki":"https://ru.wikipedia.org/?curid=1018645"}', 19),
(30, 'cat', 'Ориентальная кошка', 'Oriental Shorthair', 'IV', 'Великобритания', 'medium', NULL, NULL, 3, 5, 15, 17, 'Короткая, блестящая, без подшёрстка', 'short', 'low', 0, 'high', 'Контактный, активный, разговорчивый', '{"fci_number":null,"data_quality":"estimate","wiki":"https://ru.wikipedia.org/?curid=2589012"}', 19)
ON CONFLICT(id) DO UPDATE SET species = excluded.species, name_ru = excluded.name_ru, name_en = excluded.name_en, fci_group = excluded.fci_group, origin_country = excluded.origin_country, size_class = excluded.size_class, height_min_cm = excluded.height_min_cm, height_max_cm = excluded.height_max_cm, weight_min_kg = excluded.weight_min_kg, weight_max_kg = excluded.weight_max_kg, lifespan_min_years = excluded.lifespan_min_years, lifespan_max_years = excluded.lifespan_max_years, coat_type = excluded.coat_type, coat_length = excluded.coat_length, grooming_level = excluded.grooming_level, brachycephalic = excluded.brachycephalic, exercise_level = excluded.exercise_level, temperament = excluded.temperament, extra_json = excluded.extra_json, source_id = excluded.source_id;

-- Вес по полу (у breed_weight нет уникального ключа, поэтому через NOT EXISTS)
INSERT INTO breed_weight (breed_id, sex, age_stage, min_kg, max_kg, source_id)
SELECT 7, 'any', 'adult', 1.8, 3.2, 18
 WHERE NOT EXISTS (SELECT 1 FROM breed_weight WHERE breed_id = 7 AND sex = 'any' AND age_stage = 'adult');
INSERT INTO breed_weight (breed_id, sex, age_stage, min_kg, max_kg, source_id)
SELECT 8, 'male', 'adult', 1.5, 3, 18
 WHERE NOT EXISTS (SELECT 1 FROM breed_weight WHERE breed_id = 8 AND sex = 'male' AND age_stage = 'adult');
INSERT INTO breed_weight (breed_id, sex, age_stage, min_kg, max_kg, source_id)
SELECT 8, 'female', 'adult', 1, 2.5, 18
 WHERE NOT EXISTS (SELECT 1 FROM breed_weight WHERE breed_id = 8 AND sex = 'female' AND age_stage = 'adult');
INSERT INTO breed_weight (breed_id, sex, age_stage, min_kg, max_kg, source_id)
SELECT 9, 'any', 'adult', 7, 9, 18
 WHERE NOT EXISTS (SELECT 1 FROM breed_weight WHERE breed_id = 9 AND sex = 'any' AND age_stage = 'adult');
INSERT INTO breed_weight (breed_id, sex, age_stage, min_kg, max_kg, source_id)
SELECT 10, 'any', 'adult', 4.5, 8, 18
 WHERE NOT EXISTS (SELECT 1 FROM breed_weight WHERE breed_id = 10 AND sex = 'any' AND age_stage = 'adult');
INSERT INTO breed_weight (breed_id, sex, age_stage, min_kg, max_kg, source_id)
SELECT 11, 'any', 'adult', 6.3, 8.1, 18
 WHERE NOT EXISTS (SELECT 1 FROM breed_weight WHERE breed_id = 11 AND sex = 'any' AND age_stage = 'adult');
INSERT INTO breed_weight (breed_id, sex, age_stage, min_kg, max_kg, source_id)
SELECT 12, 'any', 'adult', 1.8, 3.5, 18
 WHERE NOT EXISTS (SELECT 1 FROM breed_weight WHERE breed_id = 12 AND sex = 'any' AND age_stage = 'adult');
INSERT INTO breed_weight (breed_id, sex, age_stage, min_kg, max_kg, source_id)
SELECT 13, 'any', 'adult', 3, 4, 18
 WHERE NOT EXISTS (SELECT 1 FROM breed_weight WHERE breed_id = 13 AND sex = 'any' AND age_stage = 'adult');
INSERT INTO breed_weight (breed_id, sex, age_stage, min_kg, max_kg, source_id)
SELECT 14, 'male', 'adult', 29, 34, 18
 WHERE NOT EXISTS (SELECT 1 FROM breed_weight WHERE breed_id = 14 AND sex = 'male' AND age_stage = 'adult');
INSERT INTO breed_weight (breed_id, sex, age_stage, min_kg, max_kg, source_id)
SELECT 14, 'female', 'adult', 25, 29, 18
 WHERE NOT EXISTS (SELECT 1 FROM breed_weight WHERE breed_id = 14 AND sex = 'female' AND age_stage = 'adult');
INSERT INTO breed_weight (breed_id, sex, age_stage, min_kg, max_kg, source_id)
SELECT 15, 'any', 'adult', 13, 15, 18
 WHERE NOT EXISTS (SELECT 1 FROM breed_weight WHERE breed_id = 15 AND sex = 'any' AND age_stage = 'adult');
INSERT INTO breed_weight (breed_id, sex, age_stage, min_kg, max_kg, source_id)
SELECT 16, 'any', 'adult', 9, 14, 18
 WHERE NOT EXISTS (SELECT 1 FROM breed_weight WHERE breed_id = 16 AND sex = 'any' AND age_stage = 'adult');
INSERT INTO breed_weight (breed_id, sex, age_stage, min_kg, max_kg, source_id)
SELECT 17, 'male', 'adult', 20.5, 28, 18
 WHERE NOT EXISTS (SELECT 1 FROM breed_weight WHERE breed_id = 17 AND sex = 'male' AND age_stage = 'adult');
INSERT INTO breed_weight (breed_id, sex, age_stage, min_kg, max_kg, source_id)
SELECT 17, 'female', 'adult', 15.5, 23, 18
 WHERE NOT EXISTS (SELECT 1 FROM breed_weight WHERE breed_id = 17 AND sex = 'female' AND age_stage = 'adult');
INSERT INTO breed_weight (breed_id, sex, age_stage, min_kg, max_kg, source_id)
SELECT 18, 'male', 'adult', 45, 50, 18
 WHERE NOT EXISTS (SELECT 1 FROM breed_weight WHERE breed_id = 18 AND sex = 'male' AND age_stage = 'adult');
INSERT INTO breed_weight (breed_id, sex, age_stage, min_kg, max_kg, source_id)
SELECT 18, 'female', 'adult', 35, 42, 18
 WHERE NOT EXISTS (SELECT 1 FROM breed_weight WHERE breed_id = 18 AND sex = 'female' AND age_stage = 'adult');
INSERT INTO breed_weight (breed_id, sex, age_stage, min_kg, max_kg, source_id)
SELECT 19, 'male', 'adult', 30, 32, 18
 WHERE NOT EXISTS (SELECT 1 FROM breed_weight WHERE breed_id = 19 AND sex = 'male' AND age_stage = 'adult');
INSERT INTO breed_weight (breed_id, sex, age_stage, min_kg, max_kg, source_id)
SELECT 19, 'female', 'adult', 25, 27, 18
 WHERE NOT EXISTS (SELECT 1 FROM breed_weight WHERE breed_id = 19 AND sex = 'female' AND age_stage = 'adult');
INSERT INTO breed_weight (breed_id, sex, age_stage, min_kg, max_kg, source_id)
SELECT 20, 'any', 'adult', 15, 20, 18
 WHERE NOT EXISTS (SELECT 1 FROM breed_weight WHERE breed_id = 20 AND sex = 'any' AND age_stage = 'adult');
INSERT INTO breed_weight (breed_id, sex, age_stage, min_kg, max_kg, source_id)
SELECT 21, 'male', 'adult', 40, 45, 18
 WHERE NOT EXISTS (SELECT 1 FROM breed_weight WHERE breed_id = 21 AND sex = 'male' AND age_stage = 'adult');
INSERT INTO breed_weight (breed_id, sex, age_stage, min_kg, max_kg, source_id)
SELECT 21, 'female', 'adult', 32, 35, 18
 WHERE NOT EXISTS (SELECT 1 FROM breed_weight WHERE breed_id = 21 AND sex = 'female' AND age_stage = 'adult');
INSERT INTO breed_weight (breed_id, sex, age_stage, min_kg, max_kg, source_id)
SELECT 22, 'any', 'adult', 5, 6, 18
 WHERE NOT EXISTS (SELECT 1 FROM breed_weight WHERE breed_id = 22 AND sex = 'any' AND age_stage = 'adult');
INSERT INTO breed_weight (breed_id, sex, age_stage, min_kg, max_kg, source_id)
SELECT 23, 'male', 'adult', 5, 7, 19
 WHERE NOT EXISTS (SELECT 1 FROM breed_weight WHERE breed_id = 23 AND sex = 'male' AND age_stage = 'adult');
INSERT INTO breed_weight (breed_id, sex, age_stage, min_kg, max_kg, source_id)
SELECT 23, 'female', 'adult', 3.5, 5, 19
 WHERE NOT EXISTS (SELECT 1 FROM breed_weight WHERE breed_id = 23 AND sex = 'female' AND age_stage = 'adult');
INSERT INTO breed_weight (breed_id, sex, age_stage, min_kg, max_kg, source_id)
SELECT 24, 'any', 'adult', 3.5, 5.5, 19
 WHERE NOT EXISTS (SELECT 1 FROM breed_weight WHERE breed_id = 24 AND sex = 'any' AND age_stage = 'adult');
INSERT INTO breed_weight (breed_id, sex, age_stage, min_kg, max_kg, source_id)
SELECT 25, 'male', 'adult', 4, 6, 18
 WHERE NOT EXISTS (SELECT 1 FROM breed_weight WHERE breed_id = 25 AND sex = 'male' AND age_stage = 'adult');
INSERT INTO breed_weight (breed_id, sex, age_stage, min_kg, max_kg, source_id)
SELECT 25, 'female', 'adult', 2.7, 4, 18
 WHERE NOT EXISTS (SELECT 1 FROM breed_weight WHERE breed_id = 25 AND sex = 'female' AND age_stage = 'adult');
INSERT INTO breed_weight (breed_id, sex, age_stage, min_kg, max_kg, source_id)
SELECT 26, 'any', 'adult', 3, 6, 18
 WHERE NOT EXISTS (SELECT 1 FROM breed_weight WHERE breed_id = 26 AND sex = 'any' AND age_stage = 'adult');
INSERT INTO breed_weight (breed_id, sex, age_stage, min_kg, max_kg, source_id)
SELECT 27, 'male', 'adult', 6, 9, 18
 WHERE NOT EXISTS (SELECT 1 FROM breed_weight WHERE breed_id = 27 AND sex = 'male' AND age_stage = 'adult');
INSERT INTO breed_weight (breed_id, sex, age_stage, min_kg, max_kg, source_id)
SELECT 27, 'female', 'adult', 3.5, 7, 18
 WHERE NOT EXISTS (SELECT 1 FROM breed_weight WHERE breed_id = 27 AND sex = 'female' AND age_stage = 'adult');
INSERT INTO breed_weight (breed_id, sex, age_stage, min_kg, max_kg, source_id)
SELECT 28, 'any', 'adult', 3, 5, 19
 WHERE NOT EXISTS (SELECT 1 FROM breed_weight WHERE breed_id = 28 AND sex = 'any' AND age_stage = 'adult');
INSERT INTO breed_weight (breed_id, sex, age_stage, min_kg, max_kg, source_id)
SELECT 29, 'any', 'adult', 3, 5, 19
 WHERE NOT EXISTS (SELECT 1 FROM breed_weight WHERE breed_id = 29 AND sex = 'any' AND age_stage = 'adult');
INSERT INTO breed_weight (breed_id, sex, age_stage, min_kg, max_kg, source_id)
SELECT 30, 'any', 'adult', 3, 5, 19
 WHERE NOT EXISTS (SELECT 1 FROM breed_weight WHERE breed_id = 30 AND sex = 'any' AND age_stage = 'adult');

-- Предрасположенности
INSERT OR IGNORE INTO breed_predisposition (breed_id, condition_id, prevalence_text, evidence_level, age_of_onset, source_id, notes) VALUES
(7, 32, 'Высокая распространённость', 'B', 'Взрослые', 9, 'Мелкие породы, скученность зубов'),
(7, 14, 'Повышенный риск', 'B', 'Молодые', 7, NULL),
(7, 15, 'Повышенный риск', 'B', 'Взрослые', 9, 'Мелкие породы, избыточный вес усиливает'),
(7, 21, 'Риск при мутации PRCD', 'C', 'Старше 3 лет', 8, 'Аутосомно-рецессивный'),
(7, 28, 'Повышенный риск', 'C', 'Молодые', 9, NULL),
(8, 14, 'Повышенный риск', 'B', 'Молодые', 7, NULL),
(8, 32, 'Высокая распространённость', 'B', 'Взрослые', 9, 'Мелкие породы'),
(8, 29, 'Повышенный риск', 'C', 'Щенки', 9, 'Открытый родничок'),
(8, 15, 'Повышенный риск', 'C', 'Взрослые', 9, NULL),
(9, 7, 'Высокая распространённость', 'A', '3–7 лет', 8, 'Ассоциация с ретрогеном FGF4 (CDPA); хондродистрофия'),
(9, 3, 'Высокая распространённость', 'B', 'Взрослые', 7, 'Избыточный вес повышает нагрузку на спину'),
(9, 32, 'Повышенный риск', 'B', 'Взрослые', 9, NULL),
(9, 14, 'Повышенный риск', 'C', 'Молодые', 7, NULL),
(10, 14, 'Повышенный риск', 'B', 'Молодые', 7, NULL),
(10, 32, 'Высокая распространённость', 'B', 'Взрослые', 9, 'Короткая морда, скученность зубов'),
(10, 16, 'Повышенный риск', 'C', 'Взрослые', 9, 'Описана семейная почечная дисплазия'),
(10, 23, 'Повышенный риск', 'C', 'Молодые', 9, NULL),
(10, 28, 'Повышенный риск', 'C', 'Щенки', 9, NULL),
(11, 5, 'Высокая распространённость', 'A', 'С раннего возраста', 7, 'Брахицефалия'),
(11, 6, 'Повышенный риск', 'B', 'Любой', 7, NULL),
(11, 3, 'Высокая распространённость', 'B', 'Взрослые', 7, NULL),
(11, 30, 'Повышенный риск', 'C', 'Молодые', 9, 'Короткая морда и «закрученный» хвост — маркеры'),
(11, 22, 'Повышенный риск', 'C', 'Взрослые', 9, NULL),
(12, 14, 'Повышенный риск', 'B', 'Молодые', 7, NULL),
(12, 15, 'Повышенный риск', 'B', 'Взрослые', 9, NULL),
(12, 32, 'Высокая распространённость', 'B', 'Взрослые', 9, NULL),
(13, 14, 'Повышенный риск', 'B', 'Молодые', 7, NULL),
(13, 32, 'Высокая распространённость', 'B', 'Взрослые', 9, NULL),
(13, 28, 'Повышенный риск', 'C', 'Щенки', 9, NULL),
(13, 23, 'Повышенный риск', 'C', 'Молодые', 9, NULL),
(14, 1, 'Повышенный риск', 'B', 'Молодые', 7, 'Полигенная предрасположенность'),
(14, 2, 'Повышенный риск', 'B', 'Молодые', 7, NULL),
(14, 18, 'Повышенный риск', 'B', '1–3 года', 7, NULL),
(14, 19, 'Повышенный риск', 'C', 'Взрослые', 9, NULL),
(14, 24, 'Повышенный риск', 'C', 'Взрослые', 7, NULL),
(14, 22, 'Повышенный риск', 'C', 'Взрослые', 9, NULL),
(15, 4, 'Высокая распространённость', 'A', 'Любой', 7, 'Висячие уши и обильная шерсть в ушном канале'),
(15, 21, 'Риск при мутации PRCD', 'B', 'Старше 3 лет', 8, 'Аутосомно-рецессивный'),
(15, 1, 'Повышенный риск', 'B', 'Взрослые', 7, NULL),
(15, 18, 'Повышенный риск', 'C', '1–3 года', 7, NULL),
(15, 22, 'Повышенный риск', 'C', 'Взрослые', 9, NULL),
(16, 3, 'Высокая распространённость', 'A', 'Взрослые', 7, 'Постоянный поиск еды, низкая насыщаемость'),
(16, 4, 'Повышенный риск', 'B', 'Любой', 7, NULL),
(16, 20, 'Повышенный риск', 'C', '6 мес – 5 лет', 7, NULL),
(16, 19, 'Повышенный риск', 'C', 'Взрослые', 9, NULL),
(16, 7, 'Повышенный риск', 'C', 'Взрослые', 9, NULL),
(17, 22, 'Повышенный риск', 'B', 'Молодые', 7, 'Наследственная катаракта описана у породы'),
(17, 21, 'Повышенный риск', 'C', 'Взрослые', 9, NULL),
(17, 1, 'Повышенный риск', 'B', 'Взрослые', 7, NULL),
(17, 18, 'Повышенный риск', 'C', '1–3 года', 7, NULL),
(18, 1, 'Повышенный риск', 'B', 'Молодые', 7, NULL),
(18, 2, 'Повышенный риск', 'B', 'Молодые', 7, NULL),
(18, 24, 'Повышенный риск', 'B', 'Взрослые', 7, NULL),
(18, 3, 'Повышенный риск', 'B', 'Взрослые', 7, NULL),
(18, 25, 'Повышенный риск', 'C', 'Любой', 9, NULL),
(19, 27, 'Высокая распространённость', 'A', 'Взрослые', 8, 'Семейная аритмогенная кардиомиопатия, описана у породы'),
(19, 5, 'Повышенный риск', 'B', 'С раннего возраста', 7, 'Брахицефалия'),
(19, 1, 'Повышенный риск', 'B', 'Взрослые', 7, NULL),
(19, 22, 'Повышенный риск', 'C', 'Взрослые', 9, NULL),
(20, 1, 'Повышенный риск', 'B', 'Взрослые', 7, NULL),
(20, 20, 'Повышенный риск', 'B', '6 мес – 5 лет', 7, 'В породе описаны семейные формы'),
(20, 21, 'Повышенный риск', 'C', 'Взрослые', 9, 'Включая колли-аномалию глаз (CEA) как отдельный офтальмологический риск'),
(20, 22, 'Повышенный риск', 'C', 'Взрослые', 9, NULL),
(21, 26, 'Высокая распространённость', 'A', 'Взрослые', 8, 'Наиболее значимая породная проблема; риск возрастает с возрастом'),
(21, 25, 'Риск при мутации VWF', 'B', 'Любой', 8, 'Аутосомно-рецессивный, неполная пенетрантность'),
(21, 19, 'Повышенный риск', 'B', 'Взрослые', 9, NULL),
(21, 24, 'Повышенный риск', 'C', 'Взрослые', 9, NULL),
(22, 14, 'Повышенный риск', 'B', 'Молодые', 7, NULL),
(22, 33, 'Риск при мутации ADAMTS17', 'B', '3–7 лет', 8, 'Первичная вывих хрусталика, аутосомно-рецессивный'),
(22, 22, 'Повышенный риск', 'C', 'Взрослые', 9, NULL),
(23, 8, 'Повышенный риск', 'B', 'Взрослые', 9, NULL),
(23, 21, 'Повышенный риск', 'C', 'Взрослые', 8, 'В породе описана прогрессирующая атрофия сетчатки'),
(23, 17, 'Повышенный риск', 'C', 'Взрослые', 9, NULL),
(24, 8, 'Повышенный риск', 'B', 'Взрослые', 9, 'Регулярное ЭхоКГ рекомендуется породными клубами'),
(24, 32, 'Повышенный риск', 'C', 'Взрослые', 9, NULL),
(25, 31, 'Связана с геном FOLD', 'A', 'Молодые', 8, 'Причина — вариант TRPV4, тот же ген даёт вислоухость; гомозиготы тяжелее'),
(25, 8, 'Повышенный риск', 'B', 'Взрослые', 9, NULL),
(25, 9, 'Повышенный риск', 'B', 'Взрослые', 9, NULL),
(26, 21, 'Риск при мутации CRX (rdAc)', 'A', '2–5 лет', 8, 'Аутосомно-рецессивный, описана у абиссинских и сомалийских кошек'),
(26, 16, 'Повышенный риск', 'B', 'Взрослые', 9, NULL),
(26, 17, 'Повышенный риск', 'C', 'Взрослые', 9, NULL),
(27, 8, 'Повышенный риск', 'B', 'Взрослые', 9, NULL),
(27, 17, 'Повышенный риск', 'C', 'Взрослые', 9, NULL),
(29, 34, 'Повышенный риск', 'B', 'Взрослые', 9, 'Порода чаще других упоминается в исследованиях астмы кошек'),
(29, 16, 'Повышенный риск', 'C', 'Старше 8 лет', 9, NULL),
(30, 34, 'Повышенный риск', 'C', 'Взрослые', 9, NULL),
(30, 8, 'Повышенный риск', 'C', 'Взрослые', 9, NULL);

-- Генетические тесты (без уникального ключа в схеме, поэтому через NOT EXISTS)
INSERT INTO genetic_test (breed_id, gene, mutation, inheritance, test_available, source_id)
SELECT 7, 'PRCD', 'c.5G>A', 'Аутосомно-рецессивный', 1, 8
 WHERE NOT EXISTS (SELECT 1 FROM genetic_test WHERE breed_id = 7 AND gene = 'PRCD');
INSERT INTO genetic_test (breed_id, gene, mutation, inheritance, test_available, source_id)
SELECT 9, 'FGF4 (CDPA)', 'Инсерция ретрогена, chr12', 'Неполное доминирование', 1, 8
 WHERE NOT EXISTS (SELECT 1 FROM genetic_test WHERE breed_id = 9 AND gene = 'FGF4 (CDPA)');
INSERT INTO genetic_test (breed_id, gene, mutation, inheritance, test_available, source_id)
SELECT 14, 'SLC4A3', 'GR-PRA1', 'Аутосомно-рецессивный', 1, 8
 WHERE NOT EXISTS (SELECT 1 FROM genetic_test WHERE breed_id = 14 AND gene = 'SLC4A3');
INSERT INTO genetic_test (breed_id, gene, mutation, inheritance, test_available, source_id)
SELECT 14, 'TTC8', 'GR-PRA2', 'Аутосомно-рецессивный', 1, 8
 WHERE NOT EXISTS (SELECT 1 FROM genetic_test WHERE breed_id = 14 AND gene = 'TTC8');
INSERT INTO genetic_test (breed_id, gene, mutation, inheritance, test_available, source_id)
SELECT 14, 'PNPLA1', 'Ichthyosis', 'Аутосомно-рецессивный', 1, 8
 WHERE NOT EXISTS (SELECT 1 FROM genetic_test WHERE breed_id = 14 AND gene = 'PNPLA1');
INSERT INTO genetic_test (breed_id, gene, mutation, inheritance, test_available, source_id)
SELECT 15, 'PRCD', 'c.5G>A', 'Аутосомно-рецессивный', 1, 8
 WHERE NOT EXISTS (SELECT 1 FROM genetic_test WHERE breed_id = 15 AND gene = 'PRCD');
INSERT INTO genetic_test (breed_id, gene, mutation, inheritance, test_available, source_id)
SELECT 19, 'SOD1', 'c.118G>A', 'Аутосомно-рецессивный', 1, 8
 WHERE NOT EXISTS (SELECT 1 FROM genetic_test WHERE breed_id = 19 AND gene = 'SOD1');
INSERT INTO genetic_test (breed_id, gene, mutation, inheritance, test_available, source_id)
SELECT 20, 'NHEJ1', 'CEA', 'Аутосомно-рецессивный', 1, 8
 WHERE NOT EXISTS (SELECT 1 FROM genetic_test WHERE breed_id = 20 AND gene = 'NHEJ1');
INSERT INTO genetic_test (breed_id, gene, mutation, inheritance, test_available, source_id)
SELECT 21, 'VWF', 'c.7437G>A (vWD1)', 'Аутосомно-рецессивный', 1, 8
 WHERE NOT EXISTS (SELECT 1 FROM genetic_test WHERE breed_id = 21 AND gene = 'VWF');
INSERT INTO genetic_test (breed_id, gene, mutation, inheritance, test_available, source_id)
SELECT 22, 'ADAMTS17', 'PLL', 'Аутосомно-рецессивный', 1, 8
 WHERE NOT EXISTS (SELECT 1 FROM genetic_test WHERE breed_id = 22 AND gene = 'ADAMTS17');
INSERT INTO genetic_test (breed_id, gene, mutation, inheritance, test_available, source_id)
SELECT 25, 'TRPV4', 'FOLD (вислоухость/остеохондродисплазия)', 'Аутосомно-доминантный с неполной пенетрантностью', 1, 8
 WHERE NOT EXISTS (SELECT 1 FROM genetic_test WHERE breed_id = 25 AND gene = 'TRPV4');
INSERT INTO genetic_test (breed_id, gene, mutation, inheritance, test_available, source_id)
SELECT 26, 'CRX', 'rdAc (делеция 29 п.н.)', 'Аутосомно-рецессивный', 1, 8
 WHERE NOT EXISTS (SELECT 1 FROM genetic_test WHERE breed_id = 26 AND gene = 'CRX');

-- Правки исходных данных (идемпотентные)
-- Британская короткошёрстная: общий диапазон веса не включал сук (3,5–5,5 кг из breed_weight)
UPDATE breed SET weight_min_kg = 3.5 WHERE id = 6 AND weight_min_kg > 3.5;

-- Версия датасета
INSERT INTO dataset_version (version, released_at, notes)
SELECT '2026.11-demo-2', date('now'), 'Breed DB расширена: +24 пород (16 собак, 8 кошек), +21 заболеваний, +12 гентестов'
 WHERE NOT EXISTS (SELECT 1 FROM dataset_version WHERE version = '2026.11-demo-2');

