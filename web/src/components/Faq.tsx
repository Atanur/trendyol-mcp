import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { FAQ } from '@/data/content';

export default function Faq() {
  return (
    <Accordion className="w-full">
      {FAQ.map((item) => (
        <AccordionItem key={item.q} value={item.q}>
          <AccordionTrigger className="text-base">{item.q}</AccordionTrigger>
          <AccordionContent className="text-[0.95rem] text-muted-foreground">{item.a}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
