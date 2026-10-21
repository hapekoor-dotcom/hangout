import type {EventItem,Intent} from './types.ts'
export function summarizeEvent(event:EventItem,intent:Intent):string{
 let fit=''
 if(intent.soloFriendly&&event.soloFriendly)fit='An option you can join on your own.'
 else if(intent.kidFriendly&&event.kidFriendly)fit='You can bring the kids with you.'
 else if(intent.socialContext==='friends')fit='A plan you can share with friends.'
 else if(intent.socialContext==='couple'&&event.tags.includes('couple'))fit='There’s time to spend together without a packed schedule.'
 else if(intent.noiseLevel==='low'&&event.noiseLevel==='low')fit='It fits a quieter evening.'
 else if(intent.budgetMax===0&&event.price===0)fit='There’s no entry fee to budget for.'
 if(event.source==='fienta'&&!event.description)return 'The organiser’s full details are available on Fienta.'
 return event.description+(fit?' '+fit:'')
}
