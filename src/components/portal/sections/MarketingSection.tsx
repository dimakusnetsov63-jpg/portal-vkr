import { SectionUnderDevelopment } from "@/components/portal/ui/SectionUnderDevelopment";

/**
 * Раздел пуст намеренно (C-7). До этого он показывал бюджеты, стоимость
 * отклика и стоимость выхода по шести каналам — всё из константы `CHANNELS`
 * в `lib/portal/constants.ts`, то есть цифры были придуманы целиком.
 */
export function MarketingSection() {
  return (
    <SectionUnderDevelopment
      title="Маркетинг"
      description="Здесь появится эффективность каналов привлечения: расход по каждому каналу, стоимость отклика и стоимость выхода на смену."
      dependencies={[
        "учёт рекламных кампаний и расходов по каналам",
        "связь кандидата с каналом, из которого он пришёл",
      ]}
    />
  );
}
