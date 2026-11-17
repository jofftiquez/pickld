// Sticker art for the marketing pages, imported from the app's own files (repo-root assets/stickers/<pack>/<name>.png,
// the same art the app bundles), so next/image sizes and serves them. A few current stickers per pack; Olivia in full.
// Word-art packs use their restyled -v2 files (0065). Pack names, kinds and descriptions follow the catalog (0029, 0060,
// 0065); copy lives in en.json under stickers.packs.<slug>.
import type { StaticImageData } from 'next/image';

import olivia_queen from '../../../../assets/stickers/olivia/queen.png';
import olivia_heart_eyes from '../../../../assets/stickers/olivia/heart-eyes.png';
import olivia_zoomies from '../../../../assets/stickers/olivia/zoomies.png';
import olivia_box_boss from '../../../../assets/stickers/olivia/box-boss.png';
import olivia_loaf_nap from '../../../../assets/stickers/olivia/loaf-nap.png';
import olivia_unimpressed from '../../../../assets/stickers/olivia/unimpressed.png';
import olivia_big_yawn from '../../../../assets/stickers/olivia/big-yawn.png';
import olivia_blanket_burrito from '../../../../assets/stickers/olivia/blanket-burrito.png';
import olivia_cold_shoulder from '../../../../assets/stickers/olivia/cold-shoulder.png';
import olivia_cup_push from '../../../../assets/stickers/olivia/cup-push.png';
import olivia_diva from '../../../../assets/stickers/olivia/diva.png';
import olivia_grooming from '../../../../assets/stickers/olivia/grooming.png';
import olivia_grumpy_floof from '../../../../assets/stickers/olivia/grumpy-floof.png';
import olivia_lounge_queen from '../../../../assets/stickers/olivia/lounge-queen.png';
import olivia_meow_drama from '../../../../assets/stickers/olivia/meow-drama.png';
import olivia_treat_please from '../../../../assets/stickers/olivia/treat-please.png';
import everyday_cat from '../../../../assets/stickers/everyday/cat.png';
import everyday_dog from '../../../../assets/stickers/everyday/dog.png';
import everyday_frog from '../../../../assets/stickers/everyday/frog.png';
import everyday_chick from '../../../../assets/stickers/everyday/chick.png';
import everyday_mango from '../../../../assets/stickers/everyday/mango.png';
import everyday_watermelon from '../../../../assets/stickers/everyday/watermelon.png';
import the_eight_sunrise from '../../../../assets/stickers/the-eight/sunrise.png';
import the_eight_map_pin from '../../../../assets/stickers/the-eight/map-pin.png';
import the_eight_milk_tea from '../../../../assets/stickers/the-eight/milk-tea.png';
import the_eight_book_stack from '../../../../assets/stickers/the-eight/book-stack.png';
import the_eight_sneaker from '../../../../assets/stickers/the-eight/sneaker.png';
import the_eight_sleepy_moon from '../../../../assets/stickers/the-eight/sleepy-moon.png';
import stamps_date from '../../../../assets/stickers/stamps/date.png';
import stamps_time from '../../../../assets/stickers/stamps/time.png';
import stamps_real_day from '../../../../assets/stickers/stamps/real-day.png';
import stamps_no_filter from '../../../../assets/stickers/stamps/no-filter.png';
import stamps_photo_dump from '../../../../assets/stickers/stamps/photo-dump.png';
import stamps_on_this_day from '../../../../assets/stickers/stamps/on-this-day.png';
import milestones_first_full_jar from '../../../../assets/stickers/milestones/first-full-jar.png';
import milestones_full_jars_7 from '../../../../assets/stickers/milestones/full-jars-7.png';
import milestones_jars_30 from '../../../../assets/stickers/milestones/jars-30.png';
import milestones_jars_100 from '../../../../assets/stickers/milestones/jars-100.png';
import milestones_one_year from '../../../../assets/stickers/milestones/one-year.png';
import milestones_jars_200 from '../../../../assets/stickers/milestones/jars-200.png';
import christmas_2026_parol_lantern from '../../../../assets/stickers/christmas-2026/parol-lantern.png';
import christmas_2026_santa_cat from '../../../../assets/stickers/christmas-2026/santa-cat.png';
import christmas_2026_gift_box from '../../../../assets/stickers/christmas-2026/gift-box.png';
import christmas_2026_bibingka_cake from '../../../../assets/stickers/christmas-2026/bibingka-cake.png';
import christmas_2026_puto_bumbong_plate from '../../../../assets/stickers/christmas-2026/puto-bumbong-plate.png';
import christmas_2026_hamon_ham from '../../../../assets/stickers/christmas-2026/hamon-ham.png';
import pinoy_life_jeepney from '../../../../assets/stickers/pinoy-life/jeepney.png';
import pinoy_life_halo_halo from '../../../../assets/stickers/pinoy-life/halo-halo.png';
import pinoy_life_sari_sari from '../../../../assets/stickers/pinoy-life/sari-sari.png';
import pinoy_life_pandesal from '../../../../assets/stickers/pinoy-life/pandesal.png';
import pinoy_life_ube_taho from '../../../../assets/stickers/pinoy-life/ube-taho.png';
import pinoy_life_videoke from '../../../../assets/stickers/pinoy-life/videoke.png';
import barkada_high_five from '../../../../assets/stickers/barkada/high-five.png';
import barkada_penguin_trio from '../../../../assets/stickers/barkada/penguin-trio.png';
import barkada_pizza from '../../../../assets/stickers/barkada/pizza.png';
import barkada_videoke_mic from '../../../../assets/stickers/barkada/videoke-mic.png';
import barkada_photo_strip from '../../../../assets/stickers/barkada/photo-strip.png';
import barkada_piggy_bank from '../../../../assets/stickers/barkada/piggy-bank.png';
import hashtags_tgif from '../../../../assets/stickers/hashtags/tgif.png';
import hashtags_lunes_na_naman from '../../../../assets/stickers/hashtags/lunes-na-naman.png';
import hashtags_exam_na from '../../../../assets/stickers/hashtags/exam-na.png';
import hashtags_sahod from '../../../../assets/stickers/hashtags/sahod.png';
import hashtags_petsa_de_peligro from '../../../../assets/stickers/hashtags/petsa-de-peligro.png';
import hashtags_walang_pasok from '../../../../assets/stickers/hashtags/walang-pasok.png';
import work_from_wherever_cat_on_laptop from '../../../../assets/stickers/work-from-wherever/cat-on-laptop.png';
import work_from_wherever_coffee_mug from '../../../../assets/stickers/work-from-wherever/coffee-mug.png';
import work_from_wherever_headphones from '../../../../assets/stickers/work-from-wherever/headphones.png';
import work_from_wherever_desk_plant from '../../../../assets/stickers/work-from-wherever/desk-plant.png';
import work_from_wherever_sticky_notes from '../../../../assets/stickers/work-from-wherever/sticky-notes.png';
import work_from_wherever_bento_box from '../../../../assets/stickers/work-from-wherever/bento-box.png';
import pet_parent_bantay_dog from '../../../../assets/stickers/pet-parent/bantay-dog.png';
import pet_parent_muning_cat from '../../../../assets/stickers/pet-parent/muning-cat.png';
import pet_parent_nap_cat from '../../../../assets/stickers/pet-parent/nap-cat.png';
import pet_parent_paw_print from '../../../../assets/stickers/pet-parent/paw-print.png';
import pet_parent_walkies_dog from '../../../../assets/stickers/pet-parent/walkies-dog.png';
import pet_parent_vet_day_pup from '../../../../assets/stickers/pet-parent/vet-day-pup.png';
import fish_moods_happy from '../../../../assets/stickers/fish-moods/happy.png';
import fish_moods_in_love from '../../../../assets/stickers/fish-moods/in-love.png';
import fish_moods_hungry from '../../../../assets/stickers/fish-moods/hungry.png';
import fish_moods_sleepy from '../../../../assets/stickers/fish-moods/sleepy.png';
import fish_moods_party from '../../../../assets/stickers/fish-moods/party.png';
import fish_moods_shocked from '../../../../assets/stickers/fish-moods/shocked.png';
import corporate_noted_with_thanks_v2 from '../../../../assets/stickers/corporate/noted-with-thanks-v2.png';
import corporate_circle_back_v2 from '../../../../assets/stickers/corporate/circle-back-v2.png';
import corporate_quick_sync_v2 from '../../../../assets/stickers/corporate/quick-sync-v2.png';
import corporate_eod_na_v2 from '../../../../assets/stickers/corporate/eod-na-v2.png';
import corporate_pa_sign_po_v2 from '../../../../assets/stickers/corporate/pa-sign-po-v2.png';
import corporate_kpi_hit_v2 from '../../../../assets/stickers/corporate/kpi-hit-v2.png';
import gen_z_its_giving_v2 from '../../../../assets/stickers/gen-z/its-giving-v2.png';
import gen_z_slay_v2 from '../../../../assets/stickers/gen-z/slay-v2.png';
import gen_z_main_character_v2 from '../../../../assets/stickers/gen-z/main-character-v2.png';
import gen_z_no_cap_v2 from '../../../../assets/stickers/gen-z/no-cap-v2.png';
import gen_z_delulu_era_v2 from '../../../../assets/stickers/gen-z/delulu-era-v2.png';
import gen_z_understood_the_assignment_v2 from '../../../../assets/stickers/gen-z/understood-the-assignment-v2.png';
import trentahin_tulog_by_9_v2 from '../../../../assets/stickers/trentahin/tulog-by-9-v2.png';
import trentahin_bills_paid_v2 from '../../../../assets/stickers/trentahin/bills-paid-v2.png';
import trentahin_likod_check_v2 from '../../../../assets/stickers/trentahin/likod-check-v2.png';
import trentahin_kape_muna_v2 from '../../../../assets/stickers/trentahin/kape-muna-v2.png';
import trentahin_healing_era_v2 from '../../../../assets/stickers/trentahin/healing-era-v2.png';
import trentahin_early_dinner_club_v2 from '../../../../assets/stickers/trentahin/early-dinner-club-v2.png';
import pride_love_is_love_v2 from '../../../../assets/stickers/pride/love-is-love-v2.png';
import pride_happy_pride_v2 from '../../../../assets/stickers/pride/happy-pride-v2.png';
import pride_chosen_family_v2 from '../../../../assets/stickers/pride/chosen-family-v2.png';
import pride_be_yourself_v2 from '../../../../assets/stickers/pride/be-yourself-v2.png';
import pride_ganda_mo_mars_v2 from '../../../../assets/stickers/pride/ganda-mo-mars-v2.png';
import pride_queer_joy_v2 from '../../../../assets/stickers/pride/queer-joy-v2.png';
import cyclists_ride_on_v2 from '../../../../assets/stickers/cyclists/ride-on-v2.png';
import cyclists_coffee_ride_v2 from '../../../../assets/stickers/cyclists/coffee-ride-v2.png';
import cyclists_ahon_pa_v2 from '../../../../assets/stickers/cyclists/ahon-pa-v2.png';
import cyclists_padyak_v2 from '../../../../assets/stickers/cyclists/padyak-v2.png';
import cyclists_sunday_ride_v2 from '../../../../assets/stickers/cyclists/sunday-ride-v2.png';
import cyclists_100_km_done_v2 from '../../../../assets/stickers/cyclists/100-km-done-v2.png';

export type PackKind = 'free' | 'earned' | 'seasonal' | 'premium';

export interface Sticker {
  /** File name without .png or -v2; the alt text is en.json stickers.names.<name> or the name in words. */
  name: string;
  art: StaticImageData;
}

export interface Pack {
  slug: string;
  kind: PackKind;
  stickers: Sticker[];
}

export const packs: Pack[] = [
  {
    slug: 'olivia',
    kind: 'premium',
    stickers: [
      { name: 'queen', art: olivia_queen },
      { name: 'heart-eyes', art: olivia_heart_eyes },
      { name: 'zoomies', art: olivia_zoomies },
      { name: 'box-boss', art: olivia_box_boss },
      { name: 'loaf-nap', art: olivia_loaf_nap },
      { name: 'unimpressed', art: olivia_unimpressed },
      { name: 'big-yawn', art: olivia_big_yawn },
      { name: 'blanket-burrito', art: olivia_blanket_burrito },
      { name: 'cold-shoulder', art: olivia_cold_shoulder },
      { name: 'cup-push', art: olivia_cup_push },
      { name: 'diva', art: olivia_diva },
      { name: 'grooming', art: olivia_grooming },
      { name: 'grumpy-floof', art: olivia_grumpy_floof },
      { name: 'lounge-queen', art: olivia_lounge_queen },
      { name: 'meow-drama', art: olivia_meow_drama },
      { name: 'treat-please', art: olivia_treat_please },
    ],
  },
  {
    slug: 'everyday',
    kind: 'free',
    stickers: [
      { name: 'cat', art: everyday_cat },
      { name: 'dog', art: everyday_dog },
      { name: 'frog', art: everyday_frog },
      { name: 'chick', art: everyday_chick },
      { name: 'mango', art: everyday_mango },
      { name: 'watermelon', art: everyday_watermelon },
    ],
  },
  {
    slug: 'the-eight',
    kind: 'free',
    stickers: [
      { name: 'sunrise', art: the_eight_sunrise },
      { name: 'map-pin', art: the_eight_map_pin },
      { name: 'milk-tea', art: the_eight_milk_tea },
      { name: 'book-stack', art: the_eight_book_stack },
      { name: 'sneaker', art: the_eight_sneaker },
      { name: 'sleepy-moon', art: the_eight_sleepy_moon },
    ],
  },
  {
    slug: 'stamps',
    kind: 'free',
    stickers: [
      { name: 'date', art: stamps_date },
      { name: 'time', art: stamps_time },
      { name: 'real-day', art: stamps_real_day },
      { name: 'no-filter', art: stamps_no_filter },
      { name: 'photo-dump', art: stamps_photo_dump },
      { name: 'on-this-day', art: stamps_on_this_day },
    ],
  },
  {
    slug: 'milestones',
    kind: 'earned',
    stickers: [
      { name: 'first-full-jar', art: milestones_first_full_jar },
      { name: 'full-jars-7', art: milestones_full_jars_7 },
      { name: 'jars-30', art: milestones_jars_30 },
      { name: 'jars-100', art: milestones_jars_100 },
      { name: 'one-year', art: milestones_one_year },
      { name: 'jars-200', art: milestones_jars_200 },
    ],
  },
  {
    slug: 'christmas-2026',
    kind: 'seasonal',
    stickers: [
      { name: 'parol-lantern', art: christmas_2026_parol_lantern },
      { name: 'santa-cat', art: christmas_2026_santa_cat },
      { name: 'gift-box', art: christmas_2026_gift_box },
      { name: 'bibingka-cake', art: christmas_2026_bibingka_cake },
      { name: 'puto-bumbong-plate', art: christmas_2026_puto_bumbong_plate },
      { name: 'hamon-ham', art: christmas_2026_hamon_ham },
    ],
  },
  {
    slug: 'pinoy-life',
    kind: 'premium',
    stickers: [
      { name: 'jeepney', art: pinoy_life_jeepney },
      { name: 'halo-halo', art: pinoy_life_halo_halo },
      { name: 'sari-sari', art: pinoy_life_sari_sari },
      { name: 'pandesal', art: pinoy_life_pandesal },
      { name: 'ube-taho', art: pinoy_life_ube_taho },
      { name: 'videoke', art: pinoy_life_videoke },
    ],
  },
  {
    slug: 'barkada',
    kind: 'premium',
    stickers: [
      { name: 'high-five', art: barkada_high_five },
      { name: 'penguin-trio', art: barkada_penguin_trio },
      { name: 'pizza', art: barkada_pizza },
      { name: 'videoke-mic', art: barkada_videoke_mic },
      { name: 'photo-strip', art: barkada_photo_strip },
      { name: 'piggy-bank', art: barkada_piggy_bank },
    ],
  },
  {
    slug: 'hashtags',
    kind: 'premium',
    stickers: [
      { name: 'tgif', art: hashtags_tgif },
      { name: 'lunes-na-naman', art: hashtags_lunes_na_naman },
      { name: 'exam-na', art: hashtags_exam_na },
      { name: 'sahod', art: hashtags_sahod },
      { name: 'petsa-de-peligro', art: hashtags_petsa_de_peligro },
      { name: 'walang-pasok', art: hashtags_walang_pasok },
    ],
  },
  {
    slug: 'work-from-wherever',
    kind: 'premium',
    stickers: [
      { name: 'cat-on-laptop', art: work_from_wherever_cat_on_laptop },
      { name: 'coffee-mug', art: work_from_wherever_coffee_mug },
      { name: 'headphones', art: work_from_wherever_headphones },
      { name: 'desk-plant', art: work_from_wherever_desk_plant },
      { name: 'sticky-notes', art: work_from_wherever_sticky_notes },
      { name: 'bento-box', art: work_from_wherever_bento_box },
    ],
  },
  {
    slug: 'pet-parent',
    kind: 'premium',
    stickers: [
      { name: 'bantay-dog', art: pet_parent_bantay_dog },
      { name: 'muning-cat', art: pet_parent_muning_cat },
      { name: 'nap-cat', art: pet_parent_nap_cat },
      { name: 'paw-print', art: pet_parent_paw_print },
      { name: 'walkies-dog', art: pet_parent_walkies_dog },
      { name: 'vet-day-pup', art: pet_parent_vet_day_pup },
    ],
  },
  {
    slug: 'fish-moods',
    kind: 'premium',
    stickers: [
      { name: 'happy', art: fish_moods_happy },
      { name: 'in-love', art: fish_moods_in_love },
      { name: 'hungry', art: fish_moods_hungry },
      { name: 'sleepy', art: fish_moods_sleepy },
      { name: 'party', art: fish_moods_party },
      { name: 'shocked', art: fish_moods_shocked },
    ],
  },
  {
    slug: 'corporate',
    kind: 'premium',
    stickers: [
      { name: 'noted-with-thanks', art: corporate_noted_with_thanks_v2 },
      { name: 'circle-back', art: corporate_circle_back_v2 },
      { name: 'quick-sync', art: corporate_quick_sync_v2 },
      { name: 'eod-na', art: corporate_eod_na_v2 },
      { name: 'pa-sign-po', art: corporate_pa_sign_po_v2 },
      { name: 'kpi-hit', art: corporate_kpi_hit_v2 },
    ],
  },
  {
    slug: 'gen-z',
    kind: 'premium',
    stickers: [
      { name: 'its-giving', art: gen_z_its_giving_v2 },
      { name: 'slay', art: gen_z_slay_v2 },
      { name: 'main-character', art: gen_z_main_character_v2 },
      { name: 'no-cap', art: gen_z_no_cap_v2 },
      { name: 'delulu-era', art: gen_z_delulu_era_v2 },
      { name: 'understood-the-assignment', art: gen_z_understood_the_assignment_v2 },
    ],
  },
  {
    slug: 'trentahin',
    kind: 'premium',
    stickers: [
      { name: 'tulog-by-9', art: trentahin_tulog_by_9_v2 },
      { name: 'bills-paid', art: trentahin_bills_paid_v2 },
      { name: 'likod-check', art: trentahin_likod_check_v2 },
      { name: 'kape-muna', art: trentahin_kape_muna_v2 },
      { name: 'healing-era', art: trentahin_healing_era_v2 },
      { name: 'early-dinner-club', art: trentahin_early_dinner_club_v2 },
    ],
  },
  {
    slug: 'pride',
    kind: 'premium',
    stickers: [
      { name: 'love-is-love', art: pride_love_is_love_v2 },
      { name: 'happy-pride', art: pride_happy_pride_v2 },
      { name: 'chosen-family', art: pride_chosen_family_v2 },
      { name: 'be-yourself', art: pride_be_yourself_v2 },
      { name: 'ganda-mo-mars', art: pride_ganda_mo_mars_v2 },
      { name: 'queer-joy', art: pride_queer_joy_v2 },
    ],
  },
  {
    slug: 'cyclists',
    kind: 'premium',
    stickers: [
      { name: 'ride-on', art: cyclists_ride_on_v2 },
      { name: 'coffee-ride', art: cyclists_coffee_ride_v2 },
      { name: 'ahon-pa', art: cyclists_ahon_pa_v2 },
      { name: 'padyak', art: cyclists_padyak_v2 },
      { name: 'sunday-ride', art: cyclists_sunday_ride_v2 },
      { name: '100-km-done', art: cyclists_100_km_done_v2 },
    ],
  },
];

export function pack(slug: string): Pack {
  const found = packs.find((p) => p.slug === slug);
  if (!found) throw new Error(`unknown pack ${slug}`);
  return found;
}

/** A sticker's alt text: its name in words, e.g. 'big-yawn' → 'Big yawn'. */
export function stickerLabel(name: string): string {
  const words = name.replace(/-/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}
