# Схема базы v2: что было перепутано и что исправлено

**Дата:** 21.11.2026  
**Файлы:** [schema.sqlite.sql](schema.sqlite.sql), [schema.postgres.sql](schema.postgres.sql), [normalize.js](normalize.js).

---

## 1. Что было не так

В первой версии `product` смешивал три сущности:

- товар/формулу;
- конкретную упаковку;
- штрихкод.

Из-за этого:

- «400 г» и «2 кг» одного корма могли стать разными продуктами;
- название содержало вес (`... 75 г`), что мешало дедупликации;
- у товара был один `source_url`, хотя у одного продукта может быть несколько страниц;
- `gtin` лежал и в `product`, и в `package`;
- сертификаты не имели области действия (`brand` / `product` / `batch`);
- не было очереди проверки.

---

## 2. Новая модель

```
brand → product (формула) → package (вес, GTIN, цена)
                         ├→ product_nutrient
                         ├→ product_ingredient
                         ├→ product_protein_source
                         ├→ claim
                         ├→ feeding_guide
                         ├→ product_source_page (много URL)
                         └→ certificate (scope)
```

### product

- `name` — очищенное название без веса;
- `name_key` — ключ дедупликации: бренд + имя + вид + форма + рынок;
- `species`, `form`, `completeness`, `market`;
- `source_url` — канонический URL;
- уникальность: `(brand_id, name_key, species, form, market)`.

### package

- `weight_g`, `pack_count`, `gtin`;
- один продукт — много упаковок;
- цена — в `price_snapshot`, привязана к упаковке.

### Класс корма

В `product` добавлены:

- `class` — `economy`, `premium`, `super_premium`, `holistic`, `unknown`;
- `class_source` — `brand_default`, `name_rule`, `manual`;
- `class_confidence`.

Классификация — маркетинговая, не оценка питательности. По умолчанию задаётся брендом, вручную можно переопределить. `db/classify.js` проставляет:

| Класс | SKU |
|---|---:|
| Эконом | 98 |
| Премиум | 222 |
| Супер-премиум | 65 |
| Холистик | 114 |

### Расход корма на кг веса

В `product` добавлены:

- `food_per_kg_day` — г/кг/сут;
- `reference_weight_kg` — 4 кг кошка / 10 кг собака;
- `food_per_kg_basis` — методика;
- `food_per_kg_confidence`.

Считается из ME:

```
RER = 70 × W^0.75
MER = RER × k
граммы/сут = MER / (ME ккал/кг / 100)
г/кг/сут = граммы/сут / W
```

Референс: взрослый кастрированный, кошка 4 кг (k=1.2), собака 10 кг (k=1.6). Это справочная величина, не индивидуальная норма. `db/compute-feeding.js`.

### product_source_page

- много URL на один продукт;
- хранит `source_id`, `fetched_at`, `status`;
- старые страницы не теряются.

### certificate

- `scope`: `brand`, `product`, `batch`;
- `type`: declaration, vet_certificate, quality, unknown;
- `status`: found, not_found, expired, unreadable.

### review_queue

- очередь ручной проверки: конфликты, пропуски, низкая уверенность.

---

## 3. Правила очистки

`normalize.js`:

1. Убирает из названия вес: `75 г`, `2 кг`, `400 g`.
2. Убирает `®`, `™`, хвосты «купить».
3. Считает `name_key`.
4. Сливает дубли по `name_key`.
5. Переносит упаковки, нутриенты, ингредиенты, аллергены, цены и сертификаты на оставшийся продукт.
6. Создаёт `product_source_page` из `source_url`.
7. Пересобирает FTS5-индекс.

---

## 4. Результат после пересборки

- **499 продуктов**;
- **27 брендов** с товарами;
- **694 строки нутриентов**;
- **543 упаковки**;
- **499 source page**;
- **499 FTS-документов**;
- **9 записей сертификатов** (все `not_found`).

---

## 5. Как пересобрать

```bash
node db/import.js       # схема + seed
node db/normalize.js    # очистка имён, дедупликация, FTS
node db/classify.js     # класс корма
node agent/collect.js   # сбор с сайтов
node db/normalize.js    # финальная нормализация
node db/classify.js     # классификация новых SKU
node agent/export-html.js
```

---

## 6. Что ещё стоит добавить

1. `product_variant` для рынков с разными формулами (сейчас `market` на продукте).
2. `ingredient_alias` для разных названий одного ингредиента.
3. `nutrient_source_method` (label / calculated / publication).
4. `certificate_document` для PDF и OCR.
5. `review_queue` UI.




