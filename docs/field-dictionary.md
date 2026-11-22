# Словарь полей

**Назначение:** единые коды, единицы и правила для Nutrition DB и Breed DB.

---

## 1. Нутриенты

### 1.1 Макронутриенты и энергия

| Код | Название | Единица | Приоритет | Примечание |
|---|---|---|---|---|
| `protein` | Белок | % | 1 | Сырой протеин, as-fed |
| `fat` | Жир | % | 1 | Сырой жир |
| `fiber` | Клетчатка | % | 1 | Сырая клетчатка |
| `ash` | Зола | % | 1 | Минеральная часть |
| `moisture` | Влага | % | 1 | Нужна для DM |
| `carbs_nfe` | Углеводы (NFE) | % | 1 | Расчёт: 100 − белок − жир − клетчатка − зола − влага |
| `me` | Метаболическая энергия | ккал/кг | 1 | Метод: declared / modified Atwater |

### 1.2 Аминокислоты

| Код | Название | Единица | Приоритет |
|---|---|---|---|
| `taurine` | Таурин | мг/кг | 1 (кошки) |
| `arginine` | Аргинин | % | 2 |
| `lysine` | Лизин | % | 2 |
| `methionine` | Метионин | % | 2 |
| `cystine` | Цистин | % | 3 |
| `tryptophan` | Триптофан | % | 3 |
| `threonine` | Треонин | % | 3 |
| `valine` | Валин | % | 3 |
| `isoleucine` | Изолейцин | % | 3 |
| `leucine` | Лейцин | % | 3 |
| `phenylalanine` | Фенилаланин | % | 3 |
| `histidine` | Гистидин | % | 3 |

### 1.3 Жирные кислоты

| Код | Название | Единица | Приоритет |
|---|---|---|---|
| `omega3` | Омега-3 | % | 2 |
| `omega6` | Омега-6 | % | 3 |
| `epa` | EPA | % | 2 |
| `dha` | DHA | % | 2 |
| `arachidonic` | Арахидоновая кислота | % | 3 (кошки) |

### 1.4 Витамины

| Код | Название | Единица | Приоритет |
|---|---|---|---|
| `vitamin_a` | Витамин A | МЕ/кг | 1 |
| `vitamin_d3` | Витамин D3 | МЕ/кг | 1 |
| `vitamin_e` | Витамин E | мг/кг | 1 |
| `vitamin_k` | Витамин K | мг/кг | 3 |
| `vitamin_c` | Витамин C | мг/кг | 2 |
| `vitamin_b1` | B1 (тиамин) | мг/кг | 2 |
| `vitamin_b2` | B2 (рибофлавин) | мг/кг | 2 |
| `vitamin_b3` | B3 (ниацин) | мг/кг | 2 |
| `vitamin_b5` | B5 (пантотеновая) | мг/кг | 2 |
| `vitamin_b6` | B6 (пиридоксин) | мг/кг | 2 |
| `vitamin_b7` | B7 (биотин) | мг/кг | 3 |
| `vitamin_b9` | B9 (фолиевая) | мг/кг | 3 |
| `vitamin_b12` | B12 (кобаламин) | мг/кг | 3 |
| `choline` | Холин | мг/кг | 3 |

### 1.5 Минералы

| Код | Название | Единица | Приоритет |
|---|---|---|---|
| `calcium` | Кальций | % | 1 |
| `phosphorus` | Фосфор | % | 1 |
| `ca_p_ratio` | Ca:P | ratio | 1 |
| `magnesium` | Магний | % | 2 |
| `sodium` | Натрий | % | 2 |
| `potassium` | Калий | % | 2 |
| `chlorine` | Хлор | % | 3 |
| `iron` | Железо | мг/кг | 2 |
| `zinc` | Цинк | мг/кг | 2 |
| `copper` | Медь | мг/кг | 2 |
| `manganese` | Марганец | мг/кг | 2 |
| `selenium` | Селен | мг/кг | 2 |
| `iodine` | Йод | мг/кг | 2 |
| `cobalt` | Кобальт | мг/кг | 3 |

### 1.6 Прочее

| Код | Название | Единица | Приоритет |
|---|---|---|---|
| `l_carnitine` | L-карнитин | мг/кг | 3 |
| `glucosamine` | Глюкозамин | мг/кг | 3 |
| `chondroitin` | Хондроитин | мг/кг | 3 |
| `beta_carotene` | Бета-каротин | мг/кг | 3 |

---

## 2. Правила базисов

### As-fed

Значение, как на упаковке: проценты от общего веса продукта, включая воду.

### Dry matter (DM)

```
DM% = 100 − moisture%
value_dm = value_as_fed / (DM% / 100)
```

Для `%`, `мг/кг`, `МЕ/кг`, `ккал/кг` — одна и та же формула.

### Per 1000 kcal

```
value_per_1000kcal = value_as_fed / me_kcal_per_kg × 1000
```

Для процентов корректнее пересчитывать в г/1000 ккал:

```
g_per_1000kcal = value_percent × 10 / me_kcal_per_kg × 1000
```

### Проверки

- сумма белка, жира, клетчатки, золы и влаги: 95–100%;
- углеводы не отрицательные;
- ME по modified Atwater: `3,5×белок + 8,5×жир + 3,5×углеводы` (ккал/100 г);
- расхождение с заявленной ME: ≤15–20%;
- DM-значения не превышают 100% для макронутриентов.

---

## 3. Поля породы

| Поле | Тип | Описание |
|---|---|---|
| `species` | enum | dog / cat |
| `name_ru`, `name_en` | text | Названия и синонимы |
| `fci_group` | text | Группа FCI |
| `origin_country` | text | Страна происхождения |
| `size_class` | enum | mini / small / medium / large / giant |
| `height_min_cm`, `height_max_cm` | number | Высота в холке |
| `weight_min_kg`, `weight_max_kg` | number | Диапазон веса |
| `lifespan_min_years`, `lifespan_max_years` | number | Продолжительность жизни |
| `coat_type` | text | Тип шерсти |
| `coat_length` | enum | short / medium / long / hairless |
| `grooming_level` | enum | low / medium / high |
| `brachycephalic` | boolean | Брахицефалия |
| `exercise_level` | enum | low / medium / high |
| `temperament` | text | Темперамент |
| `extra_json` | json | Дополнительные признаки |

### Наследственные заболевания

| Поле | Тип | Описание |
|---|---|---|
| `condition_id` | FK | Болезнь/состояние |
| `prevalence_text` | text | «повышенный риск», «высокая распространённость» |
| `evidence_level` | enum | A / B / C / D |
| `age_of_onset` | text | Возраст начала |
| `source_id` | FK | Источник |
| `notes` | text | Оговорки |

### Генетические тесты

| Поле | Тип | Описание |
|---|---|---|
| `gene` | text | Ген |
| `mutation` | text | Мутация |
| `inheritance` | text | Тип наследования |
| `test_available` | boolean | Доступность теста |

---

## 4. Аллергены и источники белка

| Поле | Тип | Описание |
|---|---|---|
| `allergen_group.code` | text | poultry, mammalian, dairy, fish, egg, wheat, soy, corn, rice, legumes, plant_other |
| `protein_source.code` | text | chicken, turkey, beef, salmon, dairy, wheat… |
| `protein_source.group_code` | FK | Группа перекрёстной реактивности |
| `product_protein_source.role` | enum | primary / secondary / trace |
| `product_protein_source.declared_percent` | number | Заявленный процент сырья |
| `product_protein_source.is_hydrolyzed` | boolean | Гидролизованный компонент |
| `product_protein_source.confidence` | number | Уверенность привязки |

Правила:

- если в составе «птица» без вида → `poultry_unspecified`, продукт попадает в `may_contain: poultry`;
- если в составе «мясо» без вида — отдельного кода пока нет, ставим `may_contain` и ручную проверку;
- `exclude_allergen=chicken` исключает всю группу `poultry` — консервативно из-за перекрёстной реактивности;
- `protein_source=turkey` — точное совпадение, не вся группа.

---

## 5. Уровни доказательности

- **A** — метаанализ или крупная когорта, воспроизведено.
- **B** — одно крупное исследование (VetCompass, Agria).
- **C** — несколько мелких исследований или породные клубы.
- **D** — экспертное мнение, единичные наблюдения.

В API всегда возвращать `evidence_level` и `source`, иначе данные будут выглядеть как медицинская рекомендация.
