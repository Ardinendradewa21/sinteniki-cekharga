import { z } from "zod";

import { ACTIVITIES, MAX_PRIORITIES, PRIORITIES, REQUIREMENTS } from "@/lib/assistant/needs-options";

/** Kebutuhan yang terkumpul sejauh percakapan berjalan. */
export const collectedSchema = z.object({
  budgetIdr: z.number().int().positive().max(500_000_000).nullable(),
  budgetIsHard: z.boolean().nullable(),
  activities: z.array(z.enum(ACTIVITIES)),
  /** Prioritas berperingkat, paling penting dulu. */
  priorities: z.array(z.enum(PRIORITIES)).max(MAX_PRIORITIES),
  requirements: z.array(z.enum(REQUIREMENTS)),
  /** Merek yang disebut pengguna, apa adanya; dicocokkan ke katalog oleh kode. */
  brands: z.array(z.string().min(1).max(30)).max(8),
  /** true bila pengguna mewajibkan HANYA merek di atas. */
  brandsOnly: z.boolean(),
  avoidBrands: z.array(z.string().min(1).max(30)).max(8),
});
export type Collected = z.infer<typeof collectedSchema>;
