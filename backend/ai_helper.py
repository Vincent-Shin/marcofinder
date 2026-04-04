def try_basic_category_match(item):
    item_name = (item.get("item_name") or "").lower()

    if "pizza" in item_name:
        return "pizza"
    if "salad" in item_name:
        return "salad"
    if "burger" in item_name:
        return "burger"
    if "sushi" in item_name or "roll" in item_name or "sashimi" in item_name:
        return "sushi"
    if "sandwich" in item_name:
        return "sandwich"
    if "wrap" in item_name:
        return "wrap"
    if "pasta" in item_name:
        return "pasta"
    if "fries" in item_name:
        return "fries"
    if "soup" in item_name:
        return "soup"
    if "coffee" in item_name:
        return "coffee"
    if "tea" in item_name:
        return "tea"
    if "smoothie" in item_name:
        return "smoothie"
    if "bowl" in item_name:
        return "bowl"
    if "cake" in item_name or "cookie" in item_name or "donut" in item_name or "dessert" in item_name:
        return "dessert"
    if "chicken" in item_name:
        return "chicken"
    if "shrimp" in item_name or "salmon" in item_name or "tuna" in item_name:
        return "seafood"

    return "other"


def get_macro_label(value, low_cutoff, high_cutoff, low_text, mid_text, high_text):
    if value is None:
        return None

    if value >= high_cutoff:
        return high_text

    if value <= low_cutoff:
        return low_text

    return mid_text


def build_macro_sentence(macros):
    calories = macros.get("calories")
    protein_g = macros.get("protein_g")
    carbs_g = macros.get("carbs_g")
    fat_g = macros.get("fat_g")
    sodium_mg = macros.get("sodium_mg")
    sugar_g = macros.get("sugar_g")

    parts = []

    calorie_label = get_macro_label(
        calories, 250, 600,
        "lower in calories",
        "moderate in calories",
        "higher in calories"
    )
    if calorie_label:
        parts.append(calorie_label)

    protein_label = get_macro_label(
        protein_g, 10, 20,
        "lighter in protein",
        "has a moderate amount of protein",
        "has a good amount of protein"
    )
    if protein_label:
        parts.append(protein_label)

    carbs_label = get_macro_label(
        carbs_g, 15, 40,
        "lower in carbs",
        "has a moderate amount of carbs",
        "has a higher amount of carbs"
    )
    if carbs_label:
        parts.append(carbs_label)

    fat_label = get_macro_label(
        fat_g, 8, 20,
        "lower in fat",
        "has a moderate amount of fat",
        "has a higher amount of fat"
    )
    if fat_label:
        parts.append(fat_label)

    sodium_label = get_macro_label(
        sodium_mg, 300, 900,
        None,
        None,
        "It is also higher in sodium"
    )
    if sodium_label:
        parts.append(sodium_label)

    sugar_label = get_macro_label(
        sugar_g, 5, 20,
        None,
        None,
        "It also has a higher sugar content"
    )
    if sugar_label:
        parts.append(sugar_label)

    normal_parts = []
    extra_parts = []

    for part in parts:
        if part.startswith("It "):
            extra_parts.append(part)
        else:
            normal_parts.append(part)

    sentences = []

    if normal_parts:
        first_sentence = "It is " + ", ".join(normal_parts) + "."
        first_sentence = first_sentence.replace("It is has", "It has")
        sentences.append(first_sentence)

    for part in extra_parts:
        if not part.endswith("."):
            part = part + "."
        sentences.append(part)

    return " ".join(sentences).strip()


def build_food_sentence(item, category):
    item_name = (item.get("item_name") or "").strip()
    portion = (item.get("portion") or "").strip()

    if category == "pizza":
        text = f"{item_name} is a pizza item"
    elif category == "salad":
        text = f"{item_name} is a salad option"
    elif category == "burger":
        text = f"{item_name} is a burger item"
    elif category == "sushi":
        text = f"{item_name} is a sushi-style item"
    elif category == "sandwich":
        text = f"{item_name} is a sandwich option"
    elif category == "wrap":
        text = f"{item_name} is a wrap item"
    elif category == "pasta":
        text = f"{item_name} is a pasta item"
    elif category == "drink":
        text = f"{item_name} is a drink option"
    elif category == "dessert":
        text = f"{item_name} is a dessert item"
    elif category == "chicken":
        text = f"{item_name} is a chicken-based item"
    elif category == "seafood":
        text = f"{item_name} is a seafood-based item"
    elif category == "breakfast":
        text = f"{item_name} is a breakfast item"
    elif category == "bowl":
        text = f"{item_name} is a bowl-style item"
    else:
        text = f"{item_name} is a menu item"

    if portion:
        text += f" served in a {portion} portion"

    return text + "."


def generate_category_and_description(item):
    category = try_basic_category_match(item)
    macros = item.get("macros") or {}

    first_sentence = build_food_sentence(item, category)
    second_sentence = build_macro_sentence(macros)

    if second_sentence:
        description = first_sentence + " " + second_sentence
    else:
        description = first_sentence

    return {
        "category": category,
        "description": description
    }