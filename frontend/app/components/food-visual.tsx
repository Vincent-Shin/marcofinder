import { useState } from "react";

import { getCategoryMeta, imageLabel } from "../lib/catalog";
import { resolveItemImageUrl } from "../lib/media";
import type { MenuItem } from "../lib/types";

type Variant = "discover" | "thumb" | "hero" | "compare";

export function DiscoverCardVisual({ item }: { item: MenuItem }) {
  const [failed, setFailed] = useState(false);
  const url = resolveItemImageUrl(item);
  const category = getCategoryMeta(item.category);
  const hasPhoto = Boolean(url) && !failed;

  return (
    <>
      <div
        className={`food-visual food-visual--discover category-${category.key}`}
      >
        {url && !failed ? (
          <img
            src={url}
            alt=""
            className="food-visual__img"
            loading="lazy"
            decoding="async"
            onError={() => setFailed(true)}
          />
        ) : (
          <span className="food-visual__emoji" aria-hidden="true">
            {imageLabel(item)}
          </span>
        )}
      </div>
      <span className="image-chip">{hasPhoto ? "Photo" : "Preview"}</span>
    </>
  );
}

export function FoodVisualThumb({ item }: { item: MenuItem }) {
  const [failed, setFailed] = useState(false);
  const url = resolveItemImageUrl(item);
  const category = getCategoryMeta(item.category);

  return (
    <div
      className={`food-visual food-visual--thumb category-${category.key}`}
      aria-hidden="true"
    >
      {url && !failed ? (
        <img
          src={url}
          alt=""
          className="food-visual__img"
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="food-visual__emoji">{imageLabel(item)}</span>
      )}
    </div>
  );
}

export function FoodVisualHero({ item }: { item: MenuItem }) {
  const [failed, setFailed] = useState(false);
  const url = resolveItemImageUrl(item);
  const category = getCategoryMeta(item.category);

  return (
    <div className={`food-visual food-visual--hero category-${category.key}`}>
      {url && !failed ? (
        <img
          src={url}
          alt=""
          className="food-visual__img"
          loading="eager"
          decoding="async"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="food-visual__emoji">{imageLabel(item)}</span>
      )}
    </div>
  );
}

export function FoodVisualCompare({ item }: { item: MenuItem }) {
  const [failed, setFailed] = useState(false);
  const url = resolveItemImageUrl(item);
  const category = getCategoryMeta(item.category);

  return (
    <div className={`food-visual food-visual--compare category-${category.key}`}>
      {url && !failed ? (
        <img
          src={url}
          alt=""
          className="food-visual__img"
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="food-visual__emoji">{imageLabel(item)}</span>
      )}
    </div>
  );
}

export function RestaurantHeroVisual({
  imageUrl,
  label,
}: {
  imageUrl: string | null;
  label: string;
}) {
  const [failed, setFailed] = useState(false);
  const show = Boolean(imageUrl) && !failed;

  return (
    <div className="food-visual food-visual--restaurant-hero">
      {show ? (
        <img
          src={imageUrl!}
          alt=""
          className="food-visual__img"
          loading="eager"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="food-visual__emoji food-visual__emoji--sm" aria-hidden="true">
          {label.slice(0, 1).toUpperCase()}
        </span>
      )}
    </div>
  );
}
