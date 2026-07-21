The component below is the kind of thing you'll inherit.
In REVIEW.md, write the review you'd leave on the PR. Organise it however you'd actually structure one, and rank by severity — what's a blocker, what's cleanup, what order you'd fix it in. Then pick the two worst issues and show the fixed code. You don't have to rewrite the whole thing; show that you can land an incremental fix without destabilising the app.

// invoice-list.component.ts  (legacy)
@Component({
  selector: 'app-invoice-list',
  template: `
    // consider not show invoices list if section is loading
  
    // suggestion: consider using new control flow syntax for whole template
    <div *ngIf="loading">Loading...</div>
    // required: missing trackby
    <div *ngFor="let inv of invoices">
    // question: supplierName looks like plain text. Can we replace [innerHTML] with {{ inv.supplierName }} innerHTML should generally be reserved for cases where we intentionally need to render HTML.
      <span [innerHTML]="inv.supplierName"></span>
      <span>{{ inv.amount }}</span>
      // suggestion; consider using enum
      // suggestion: consider passing only id, instead of whole invoice object to finance method
      <button *ngIf="inv.status == 'APPROVED'" (click)="finance(inv)">
        Finance
      </button>
    </div>
  `,
})
// required: no any (review whole file)
export class InvoiceListComponent implements OnInit {
  invoices: any[] = [];
  loading = false;

 // suggestion: make services as readonly
  constructor(private http: HttpClient, private store: Store) {}
 
  ngOnInit() {
  // suggestion: consider moving it to signal
    this.loading = true;
    const token = localStorage.getItem('jwt');
    // required: not according to our coding guidelines. consider moving http call to service layer
    // suggestion: consider using a more reactive approach instead setting manually variable (for example using async pipe)
    this.http
      .get('https://api.scf.example/invoices?token=' + token)
      // required: no error handler (review whole file)
      .subscribe((res: any) => {
      // required: add mapper where we could prevent empty values to display in UI. for example for "amount: res.data.amount || 0"
        this.invoices = res.data;
        this.loading = false;
      });
  }

// require: missing return type
  finance(inv: any) {
  // required: not according to our coding guidelines. consider moving http call to service layer
    this.http.post('/api/finance', { id: inv.id }).subscribe(() => {
      alert('Financed!');
      // suggestion: consider using a more reactive approach instead of reloading the whole component
      this.ngOnInit();
    });
  }
}


____
My assumptions:
- new control flow is not mandatory for using inside the team
- you have DDD approach


Additional notes from my side:
- I commenting PR based on https://conventionalcomments.org
- I won't comment localstorage usage for JWT and using it directly on api call, because it's the matter that you directly spoke with engineer why it's wrong, instead of writing in PR etc
- I don't consider "constructor" approach wrong, because it's a matter of preference, and I don't want to start a discussion about it in PR. But I will comment on "readonly" usage, because it's a matter of code quality and not a matter of preference.
- "alert" I'm also skipping as I'm not aware of requirements.
- Overall If I see that type of PR, I wouldn't jump on writing comments, and instead have a call with engineer as we definetely need to discuss the approach and the way of working.

Fixed code, with the two worst issues addressed:
<span [innerHTML]="inv.supplierName"></span> --> <span>{{inv.supplierName}}</span>
jwt token exposal in the API call --> moved to "service" layer as header
