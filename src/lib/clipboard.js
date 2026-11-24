export async function copyText(value) {
  const text=String(value??'');
  if(!text)return false;
  try {
    if(navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {}
  let field;
  try {
    field=document.createElement('textarea');
    field.value=text;
    field.setAttribute('readonly','');
    field.style.position='fixed';
    field.style.left='-9999px';
    field.style.top='0';
    field.style.opacity='0';
    document.body.appendChild(field);
    field.focus();
    field.select();
    field.setSelectionRange(0,field.value.length);
    return Boolean(document.execCommand?.('copy'));
  } catch {
    return false;
  } finally {
    field?.remove();
  }
}
