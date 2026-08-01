import { Icon } from "./Icon";
import { Panel } from "./Panel";
import primitives from "./primitives.module.css";
import styles from "./SectionUnderDevelopment.module.css";

/**
 * Раздел, которого пока нет.
 *
 * Один компонент на все незавершённые разделы, а не заглушка в каждом: текст
 * должен звучать одинаково, иначе четыре разных формулировки читаются как
 * четыре разных причины.
 *
 * Правило содержимого: **никаких чисел**. Ни KPI, ни процентов, ни дат, ни
 * прогнозов, ни примеров «как это будет выглядеть». Раздел, показывающий
 * правдоподобную цифру, которая ничего не значит, хуже пустого — по нему
 * принимают решения. Именно из-за этого раздел и опустел (C-7).
 *
 * `dependencies` — то, от чего технически зависит появление раздела. Нужен,
 * чтобы «в разработке» не выглядело как «про нас забыли»: у «Аналитики»
 * причина конкретная и её честнее назвать. Сроков здесь нет намеренно —
 * обещание даты в интерфейсе живёт дольше, чем намерение её соблюсти.
 */
export function SectionUnderDevelopment({
  title,
  description,
  dependencies,
}: {
  /** Название раздела — как в меню. */
  title: string;
  /** Что здесь появится, когда раздел будет готов. */
  description: string;
  /** От чего зависит появление. Не показывается, если список пуст. */
  dependencies?: string[];
}) {
  return (
    <Panel>
      <div className={primitives.stateBlock}>
        <div className={primitives.stateIco}>
          {/* `info`, а не `gear` (занята «Настройками») и не `clock` — часы
              читались бы как обещание срока, которого мы не даём. */}
          <Icon name="info" size={24} />
        </div>
        <h4>{title}: раздел в разработке</h4>
        <p>{description}</p>

        {dependencies && dependencies.length > 0 && (
          <div className={styles.dependencies}>
            <span className={styles.dependenciesTitle}>Появится после того, как будет сделано:</span>
            <ul>
              {dependencies.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Panel>
  );
}
